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

    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    let baseQuery = supabase.from('payments').select('amount, status, created_at');
    if (fromParam) baseQuery = baseQuery.gte('created_at', fromParam);
    if (toParam) baseQuery = baseQuery.lte('created_at', toParam);

    const { data: payments, error } = await baseQuery;

    if (error) {
      return jsonResponse(500, {
        success: false,
        error: { code: 'QUERY_ERROR', message: '결제 통계 조회 실패' },
      });
    }

    const rows = payments ?? [];

    const paidPayments = rows.filter((p) => p.status === 'PAID');
    const refundedPayments = rows.filter((p) => p.status === 'REFUNDED');
    const pendingPayments = rows.filter((p) => p.status === 'PENDING' || p.status === 'INIT');
    const failedPayments = rows.filter((p) => p.status === 'FAILED');

    const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const paidCount = paidPayments.length;
    const avgOrderValue = paidCount > 0 ? Math.round(totalRevenue / paidCount) : 0;
    const refundDenominator = paidCount + refundedPayments.length;
    const refundRate = refundDenominator > 0
      ? Math.round((refundedPayments.length / refundDenominator) * 10000) / 100
      : 0;
    const pendingCount = pendingPayments.length;
    const failedCount = failedPayments.length;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyMap = new Map<string, number>();
    for (let d = new Date(sevenDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      dailyMap.set(d.toISOString().slice(0, 10), 0);
    }

    for (const p of paidPayments) {
      const dateKey = p.created_at.slice(0, 10);
      if (dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, (dailyMap.get(dateKey) ?? 0) + (p.amount ?? 0));
      }
    }

    const dailyRevenue = Array.from(dailyMap.entries()).map(([date, amount]) => ({
      date,
      amount,
    }));

    return jsonResponse(200, {
      success: true,
      data: {
        totalRevenue,
        paidCount,
        avgOrderValue,
        refundRate,
        pendingCount,
        failedCount,
        dailyRevenue,
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
