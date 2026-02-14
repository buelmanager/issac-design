import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';
import { isValidAmount } from '../../../lib/payment/validators';
import { createAstroServerClient } from '../../../lib/supabase-server';
import type { ApiResponse, OrderItem } from '../../../lib/payment/types';

const { service: paymentService } = getPaymentService();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/create-order');

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  if (!checkRateLimit(clientIp)) {
    PaymentLogger.warn('ORDER_RATE_LIMITED', { ip: clientIp });
    cleanup();
    return jsonResponse<ApiResponse>(429, {
      success: false,
      error: { code: 'RATE_LIMITED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    });
  }

  try {
    // 서버 사이드에서 로그인 사용자 확인 (쿠키 기반)
    let authUserId: string | undefined;
    let authUserEmail: string | undefined;
    try {
      const { supabase: authSupabase } = createAstroServerClient(request);
      const { data: { user } } = await authSupabase.auth.getUser();
      if (user) {
        authUserId = user.id;
        authUserEmail = user.email ?? undefined;
      }
    } catch {
      // 비로그인 사용자도 주문 가능 (guest checkout)
    }

    const body = await request.json();

    const {
      customer_name,
      customer_phone,
      customer_email,
      business_name,
      shipping_address,
      items,
      quote_id,
    } = body;

    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'customer_name is required' },
      });
    }

    if (!customer_phone || typeof customer_phone !== 'string' || !customer_phone.trim()) {
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'customer_phone is required' },
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'items array is required and must not be empty' },
      });
    }

    // 아이템 개수 제한 (최대 50개)
    const MAX_ITEMS = 50;
    if (items.length > MAX_ITEMS) {
      PaymentLogger.warn('ORDER_ITEMS_LIMIT_EXCEEDED', { item_count: items.length, max: MAX_ITEMS });
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `아이템은 최대 ${MAX_ITEMS}개까지 가능합니다` },
      });
    }

    const MAX_UNIT_PRICE = 100_000_000; // 개당 최대 1억원
    const MAX_QUANTITY = 999;
    const MIN_ORDER_AMOUNT = 100; // 토스 카드결제 최소금액
    const MAX_ORDER_AMOUNT = 500_000_000; // 총 주문 최대 5억원

    for (let i = 0; i < items.length; i++) {
      const item = items[i] as Record<string, unknown>;
      const unitPrice = Number(item.unit_price);
      const qty = Number(item.quantity);

      if (!isValidAmount(unitPrice)) {
        PaymentLogger.warn('ORDER_INVALID_PRICE', { index: i, unit_price: item.unit_price });
        cleanup();
        return jsonResponse<ApiResponse>(400, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 상품 가격입니다' },
        });
      }
      if (!isValidAmount(qty)) {
        PaymentLogger.warn('ORDER_INVALID_QUANTITY', { index: i, quantity: item.quantity });
        cleanup();
        return jsonResponse<ApiResponse>(400, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 수량입니다' },
        });
      }
      if (unitPrice > MAX_UNIT_PRICE) {
        PaymentLogger.warn('ORDER_UNIT_PRICE_EXCEEDED', { index: i, unit_price: unitPrice, max: MAX_UNIT_PRICE });
        cleanup();
        return jsonResponse<ApiResponse>(400, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '상품 가격이 허용 범위를 초과합니다' },
        });
      }
      if (qty > MAX_QUANTITY) {
        PaymentLogger.warn('ORDER_QUANTITY_EXCEEDED', { index: i, quantity: qty, max: MAX_QUANTITY });
        cleanup();
        return jsonResponse<ApiResponse>(400, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '수량이 허용 범위를 초과합니다' },
        });
      }
    }

    const orderItems: OrderItem[] = items.map((item: Record<string, unknown>, index: number) => {
      return {
        product_id: String(item.product_id ?? `item_${index}`),
        name: String(item.name ?? 'Unknown'),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        options: (item.options ?? {}) as Record<string, string>,
        thumbnail: item.thumbnail ? String(item.thumbnail) : undefined,
      };
    });

    // 총 주문 금액 검증
    const calculatedTotal = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    if (calculatedTotal < MIN_ORDER_AMOUNT) {
      PaymentLogger.warn('ORDER_AMOUNT_TOO_LOW', { total: calculatedTotal, min: MIN_ORDER_AMOUNT });
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `최소 결제금액은 ${MIN_ORDER_AMOUNT}원입니다` },
      });
    }

    if (calculatedTotal > MAX_ORDER_AMOUNT) {
      PaymentLogger.warn('ORDER_AMOUNT_EXCEEDED', { total: calculatedTotal, max: MAX_ORDER_AMOUNT });
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `최대 결제금액은 ${MAX_ORDER_AMOUNT.toLocaleString()}원입니다` },
      });
    }

    const order = await paymentService.createOrder({
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_email: authUserEmail || customer_email?.trim() || undefined,
      user_id: authUserId,
      business_name: business_name?.trim() || undefined,
      shipping_address: shipping_address ?? {},
      items: orderItems,
      quote_id: quote_id || undefined,
    });

    const idempotencyKey = `${order.id}_${Date.now()}`;
    const payment = await paymentService.createPayment(order.id, idempotencyKey);

    await paymentService.requestPayment(payment.id);

    PaymentLogger.info('PUBLIC_ORDER_CREATED', {
      order_id: order.id,
      payment_id: payment.id,
      total_amount: order.total_amount,
    });

    PaymentLogger.apiResponse(200, startTime);
    cleanup();
    return jsonResponse<ApiResponse>(200, {
      success: true,
      data: {
        order_id: order.id,
        order_number: order.order_number,
        payment_id: payment.id,
        amount: order.total_amount,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('PUBLIC_ORDER_CREATE_ERROR', error);
    PaymentLogger.apiResponse(500, startTime);
    cleanup();

    return jsonResponse<ApiResponse>(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message || '주문 처리 중 오류가 발생했습니다.' },
    });
  }
};

function jsonResponse<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
