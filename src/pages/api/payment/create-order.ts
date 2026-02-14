import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';
import { isValidAmount } from '../../../lib/payment/validators';
import type { ApiResponse, OrderItem } from '../../../lib/payment/types';

const { service: paymentService } = getPaymentService();

export const POST: APIRoute = async ({ request }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/create-order');

  try {
    const body = await request.json();

    const {
      customer_name,
      customer_phone,
      customer_email,
      business_name,
      shipping_address,
      items,
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

    const orderItems: OrderItem[] = items.map((item: Record<string, unknown>, index: number) => {
      const unitPrice = Number(item.unit_price);
      const quantity = Number(item.quantity);

      if (!isValidAmount(unitPrice)) {
        throw new Error(`Item ${index}: invalid unit_price`);
      }
      if (!isValidAmount(quantity)) {
        throw new Error(`Item ${index}: invalid quantity`);
      }

      return {
        product_id: String(item.product_id ?? `item_${index}`),
        name: String(item.name ?? 'Unknown'),
        quantity,
        unit_price: unitPrice,
        options: (item.options ?? {}) as Record<string, string>,
        thumbnail: item.thumbnail ? String(item.thumbnail) : undefined,
      };
    });

    const order = await paymentService.createOrder({
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_email: customer_email?.trim() || undefined,
      business_name: business_name?.trim() || undefined,
      shipping_address: shipping_address ?? {},
      items: orderItems,
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
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

function jsonResponse<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
