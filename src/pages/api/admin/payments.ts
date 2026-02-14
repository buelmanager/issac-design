/**
 * GET /api/admin/payments
 *
 * 어드민 결제 목록 조회 API (관리자 전용, 인증 필수)
 * service_role_key로 RLS를 우회하여 모든 결제 데이터를 조회한다.
 *
 * 쿼리 파라미터:
 * - status: 결제 상태 필터 (INIT, PENDING, PAID, FAILED, CANCELED, REFUND_PENDING, REFUNDED)
 * - search: PG 결제 ID, 멱등키 검색
 * - page: 페이지 번호 (1-based, 기본 1)
 * - page_size: 페이지 크기 (기본 20, 최대 100)
 * - payment_id: 특정 결제 상세 조회
 */
import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { verifyAdminAuth, unauthorizedResponse } from '../../../lib/payment/auth-guard';

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const supabase = createAdminClient();

    const paymentId = url.searchParams.get('payment_id');

    if (paymentId) {
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*, orders(*)')
        .eq('id', paymentId)
        .single();

      if (paymentError || !payment) {
        return jsonResponse(404, {
          success: false,
          error: { code: 'NOT_FOUND', message: '결제를 찾을 수 없습니다' },
        });
      }

      const { data: statusLogs } = await supabase
        .from('payment_status_logs')
        .select('*')
        .eq('payment_id', paymentId)
        .order('created_at', { ascending: true });

      return jsonResponse(200, {
        success: true,
        data: {
          payment,
          statusLogs: statusLogs ?? [],
        },
      });
    }

    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const page = Math.max(parseInt(url.searchParams.get('page') ?? '1', 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(url.searchParams.get('page_size') ?? '20', 10), 1),
      100
    );
    const fromDate = url.searchParams.get('from');
    const toDate = url.searchParams.get('to');
    const exportFormat = url.searchParams.get('export');

    if (exportFormat === 'csv') {
      let exportQuery = supabase
        .from('payments')
        .select('*, orders(*)')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (status && status !== 'all') exportQuery = exportQuery.eq('status', status);
      if (fromDate) exportQuery = exportQuery.gte('created_at', fromDate);
      if (toDate) exportQuery = exportQuery.lte('created_at', toDate);
      if (search) {
        exportQuery = exportQuery.or(
          `pg_payment_id.ilike.%${search}%,idempotency_key.ilike.%${search}%`
        );
      }

      const { data: exportData, error: exportError } = await exportQuery;

      if (exportError) {
        return jsonResponse(500, {
          success: false,
          error: { code: 'QUERY_ERROR', message: '내보내기 데이터 조회 실패' },
        });
      }

      const rows = exportData ?? [];
      const csvHeaders = ['주문번호', '고객명', '금액', '결제상태', 'PG사', '결제수단', '생성일', '결제일'];
      const csvRows = rows.map((p) => {
        const order = p.orders as { order_number?: string; customer_name?: string } | null;
        return [
          order?.order_number ?? '',
          order?.customer_name ?? '',
          String(p.amount ?? 0),
          p.status ?? '',
          p.pg_provider ?? '',
          p.method ?? '',
          p.created_at ?? '',
          p.paid_at ?? '',
        ].map((v) =>
          v.includes(',') || v.includes('"') || v.includes('\n')
            ? `"${v.replace(/"/g, '""')}"`
            : v
        ).join(',');
      });

      const bom = '\uFEFF';
      const csvContent = bom + [csvHeaders.join(','), ...csvRows].join('\n');

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    let query = supabase
      .from('payments')
      .select('*, orders(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (fromDate) {
      query = query.gte('created_at', fromDate);
    }

    if (toDate) {
      query = query.lte('created_at', toDate);
    }

    if (search) {
      query = query.or(
        `pg_payment_id.ilike.%${search}%,idempotency_key.ilike.%${search}%`
      );
    }

    const { data, count, error } = await query;

    if (error) {
      return jsonResponse(500, {
        success: false,
        error: { code: 'QUERY_ERROR', message: '결제 목록 조회 실패' },
      });
    }

    return jsonResponse(200, {
      success: true,
      data: {
        payments: data ?? [],
        totalCount: count ?? 0,
        page,
        pageSize,
      },
    });
  } catch (err) {
    const _unused = err instanceof Error ? err : new Error(String(err));
    return jsonResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
    });
  }
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
