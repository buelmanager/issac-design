import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { verifyAdminAuth, unauthorizedResponse } from '../../../lib/payment/auth-guard';

interface RevenueTrendItem {
  date: string;
  revenue: number;
  orders: number;
}

interface OrderStatusItem {
  status: string;
  count: number;
}

interface RecentOrder {
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface PendingActions {
  pendingQuotes: number;
  newInquiries: number;
  processingOrders: number;
}

interface KpiStats {
  totalRevenue: number;
  totalRevenueChange: number;
  todayOrders: number;
  todayOrdersChange: number;
  newMembers: number;
  newMembersChange: number;
  pendingQuotes: number;
}

interface DashboardStatsResponse {
  kpiStats: KpiStats;
  revenueTrend: RevenueTrendItem[];
  orderStatusDistribution: OrderStatusItem[];
  recentOrders: RecentOrder[];
  pendingActions: PendingActions;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function firstOfMonth(monthsAgo = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return d;
}

function calculatePercentChange(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const supabase = createAdminClient();

    const now = new Date();
    const todayStr = toDateString(now);
    const yesterdayStr = toDateString(daysAgo(1));
    const thirtyDaysAgoStr = toDateString(daysAgo(30));
    const sixtyDaysAgoStr = toDateString(daysAgo(60));
    const thisMonthStart = toDateString(firstOfMonth(0));
    const lastMonthStart = toDateString(firstOfMonth(1));
    const lastMonthEnd = toDateString(firstOfMonth(0));

    const [
      paidPaymentsRes,
      prevPaidPaymentsRes,
      todayOrdersRes,
      yesterdayOrdersRes,
      thisMonthMembersRes,
      lastMonthMembersRes,
      pendingQuotesRes,
      last30daysPaymentsRes,
      last30daysOrdersRes,
      allOrderStatusRes,
      recentOrdersRes,
      newInquiriesRes,
      processingOrdersRes,
    ] = await Promise.all([
      supabase
        .from('payments')
        .select('amount')
        .eq('status' as never, 'PAID' as never),

      supabase
        .from('payments')
        .select('amount')
        .eq('status' as never, 'PAID' as never)
        .gte('created_at' as never, sixtyDaysAgoStr as never)
        .lt('created_at' as never, thirtyDaysAgoStr as never),

      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at' as never, todayStr as never),

      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at' as never, yesterdayStr as never)
        .lt('created_at' as never, todayStr as never),

      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at' as never, thisMonthStart as never),

      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at' as never, lastMonthStart as never)
        .lt('created_at' as never, lastMonthEnd as never),

      supabase
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status' as never, 'pending' as never),

      supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status' as never, 'PAID' as never)
        .gte('created_at' as never, thirtyDaysAgoStr as never)
        .order('created_at', { ascending: true }),

      supabase
        .from('orders')
        .select('created_at')
        .gte('created_at' as never, thirtyDaysAgoStr as never)
        .order('created_at', { ascending: true }),

      supabase
        .from('orders')
        .select('status'),

      supabase
        .from('orders')
        .select('order_number, customer_name, total_amount, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10),

      supabase
        .from('contact_inquiries')
        .select('id', { count: 'exact', head: true })
        .eq('status' as never, 'new' as never),

      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status' as never, 'paid' as never),
    ]);

    const paidPayments = (paidPaymentsRes.data ?? []) as Array<{ amount: number }>;
    const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

    const prevPaidPayments = (prevPaidPaymentsRes.data ?? []) as Array<{ amount: number }>;
    const prevRevenue = prevPaidPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const recentRevenue = ((last30daysPaymentsRes.data ?? []) as Array<{ amount: number }>)
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);

    const todayOrders = todayOrdersRes.count ?? 0;
    const yesterdayOrders = yesterdayOrdersRes.count ?? 0;
    const newMembers = thisMonthMembersRes.count ?? 0;
    const lastMonthMembers = lastMonthMembersRes.count ?? 0;
    const pendingQuotes = pendingQuotesRes.count ?? 0;

    const kpiStats: KpiStats = {
      totalRevenue,
      totalRevenueChange: calculatePercentChange(recentRevenue, prevRevenue),
      todayOrders,
      todayOrdersChange: calculatePercentChange(todayOrders, yesterdayOrders),
      newMembers,
      newMembersChange: calculatePercentChange(newMembers, lastMonthMembers),
      pendingQuotes,
    };

    const revenueByDate = new Map<string, { revenue: number; orders: number }>();
    for (let i = 29; i >= 0; i--) {
      revenueByDate.set(toDateString(daysAgo(i)), { revenue: 0, orders: 0 });
    }

    for (const payment of (last30daysPaymentsRes.data ?? []) as Array<{ amount: number; created_at: string }>) {
      const entry = revenueByDate.get(toDateString(new Date(payment.created_at)));
      if (entry) entry.revenue += payment.amount ?? 0;
    }

    for (const order of (last30daysOrdersRes.data ?? []) as Array<{ created_at: string }>) {
      const entry = revenueByDate.get(toDateString(new Date(order.created_at)));
      if (entry) entry.orders += 1;
    }

    const revenueTrend: RevenueTrendItem[] = Array.from(revenueByDate.entries()).map(
      ([date, data]) => ({ date, revenue: data.revenue, orders: data.orders })
    );

    const statusCountMap = new Map<string, number>();
    for (const order of (allOrderStatusRes.data ?? []) as Array<{ status: string }>) {
      statusCountMap.set(order.status, (statusCountMap.get(order.status) ?? 0) + 1);
    }
    const orderStatusDistribution: OrderStatusItem[] = Array.from(statusCountMap.entries()).map(
      ([status, count]) => ({ status, count })
    );

    const recentOrders: RecentOrder[] = (recentOrdersRes.data ?? []).map(
      (o: Record<string, unknown>) => ({
        order_number: (o.order_number as string) ?? '',
        customer_name: (o.customer_name as string) ?? '',
        total_amount: (o.total_amount as number) ?? 0,
        status: (o.status as string) ?? '',
        created_at: (o.created_at as string) ?? '',
      })
    );

    const pendingActions: PendingActions = {
      pendingQuotes,
      newInquiries: newInquiriesRes.count ?? 0,
      processingOrders: processingOrdersRes.count ?? 0,
    };

    const responseData: DashboardStatsResponse = {
      kpiStats,
      revenueTrend,
      orderStatusDistribution,
      recentOrders,
      pendingActions,
    };

    return jsonResponse(200, { success: true, data: responseData });
  } catch (err) {
    const _error = err instanceof Error ? err : new Error(String(err));
    return jsonResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '대시보드 통계 조회 중 오류가 발생했습니다' },
    });
  }
};
