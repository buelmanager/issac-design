/**
 * GET /api/admin/members
 *
 * 어드민 회원 목록/상세/통계 조회 API (관리자 전용, 인증 필수)
 * service_role_key로 RLS를 우회하여 모든 회원 데이터를 조회한다.
 *
 * 쿼리 파라미터:
 * - view=stats: 회원 통계만 반환 (전체/상태별 수, 총 매출)
 * - member_id: 특정 회원 상세 조회 (프로필 + 주문 내역)
 * - search: 이메일, 이름, 전화번호 검색
 * - provider: 로그인 제공자 필터 (email, google, kakao)
 * - status: 상태 필터 (active, suspended, withdrawn)
 * - date_from: 가입일 시작 (ISO 8601)
 * - date_to: 가입일 종료 (ISO 8601)
 * - sort: 정렬 컬럼 (created_at, email, display_name) 기본: created_at
 * - sort_dir: 정렬 방향 (asc, desc) 기본: desc
 * - page: 페이지 번호 (1-based, 기본 1)
 * - page_size: 페이지 크기 (기본 20, 최대 100)
 *
 * PATCH /api/admin/members
 * 회원 상태 변경 및 관리자 메모 수정
 * Body: { member_id, status?, admin_notes? }
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
    const view = url.searchParams.get('view');

    // ─── 통계 모드 ───────────────────────────────────
    if (view === 'stats') {
      const { data: allProfiles, error: statsError } = await supabase
        .from('profiles')
        .select('status');

      if (statsError) {
        return jsonResponse(500, {
          success: false,
          error: { code: 'QUERY_ERROR', message: '통계 조회 실패' },
        });
      }

      const profiles = allProfiles ?? [];
      const total = profiles.length;
      const active = profiles.filter((p: { status: string }) => p.status === 'active').length;
      const suspended = profiles.filter((p: { status: string }) => p.status === 'suspended').length;
      const withdrawn = profiles.filter((p: { status: string }) => p.status === 'withdrawn').length;

      // 총 매출 집계
      const { data: revenueData } = await supabase
        .from('orders')
        .select('total_amount');

      const totalRevenue = (revenueData ?? []).reduce(
        (sum: number, o: { total_amount?: number }) => sum + (o.total_amount ?? 0),
        0
      );

      return jsonResponse(200, {
        success: true,
        data: {
          total,
          active,
          suspended,
          withdrawn,
          total_revenue: totalRevenue,
        },
      });
    }

    // ─── 회원 상세 ───────────────────────────────────
    const memberId = url.searchParams.get('member_id');

    if (memberId) {
      const { data: member, error: memberError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id' as never, memberId as never)
        .single();

      if (memberError || !member) {
        return jsonResponse(404, {
          success: false,
          error: { code: 'NOT_FOUND', message: '회원을 찾을 수 없습니다' },
        });
      }

      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_email' as never, member.email as never)
        .order('created_at', { ascending: false })
        .limit(50);

      const orderIds = (orders ?? []).map((o: { id: string }) => o.id);
      let payments: unknown[] = [];

      if (orderIds.length > 0) {
        const { data: paymentData } = await supabase
          .from('payments')
          .select('*')
          .in('order_id' as never, orderIds as never);
        payments = paymentData ?? [];
      }

      const paymentsByOrderId = new Map<string, unknown[]>();
      for (const p of payments as Array<{ order_id: string }>) {
        const list = paymentsByOrderId.get(p.order_id) ?? [];
        list.push(p);
        paymentsByOrderId.set(p.order_id, list);
      }

      const ordersWithPayments = (orders ?? []).map((order: { id: string }) => ({
        ...order,
        payments: paymentsByOrderId.get(order.id) ?? [],
      }));

      const orderCount = (orders ?? []).length;
      const totalSpent = (orders ?? []).reduce(
        (sum: number, o: { total_amount?: number }) => sum + (o.total_amount ?? 0),
        0
      );

      return jsonResponse(200, {
        success: true,
        data: {
          member,
          orders: ordersWithPayments,
          stats: { order_count: orderCount, total_spent: totalSpent },
        },
      });
    }

    // ─── 회원 목록 ───────────────────────────────────
    const search = url.searchParams.get('search');
    const provider = url.searchParams.get('provider');
    const status = url.searchParams.get('status');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const sortColumn = url.searchParams.get('sort') ?? 'created_at';
    const sortDir = url.searchParams.get('sort_dir') ?? 'desc';
    const page = Math.max(parseInt(url.searchParams.get('page') ?? '1', 10), 1);
    const pageSize = Math.min(
      Math.max(parseInt(url.searchParams.get('page_size') ?? '20', 10), 1),
      100
    );

    const allowedSortColumns = ['created_at', 'email', 'display_name'];
    const safeSort = allowedSortColumns.includes(sortColumn) ? sortColumn : 'created_at';
    const ascending = sortDir === 'asc';

    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order(safeSort as never, { ascending })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (search) {
      query = query.or(
        `email.ilike.%${search}%,display_name.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    if (provider && provider !== 'all') {
      query = query.eq('provider' as never, provider as never);
    }

    if (status && status !== 'all') {
      const allowedStatuses = ['active', 'suspended', 'withdrawn'];
      if (allowedStatuses.includes(status)) {
        query = query.eq('status' as never, status as never);
      }
    }

    if (dateFrom) {
      query = query.gte('created_at' as never, dateFrom as never);
    }

    if (dateTo) {
      query = query.lte('created_at' as never, (dateTo + 'T23:59:59.999Z') as never);
    }

    const { data: members, count, error } = await query;

    if (error) {
      return jsonResponse(500, {
        success: false,
        error: { code: 'QUERY_ERROR', message: '회원 목록 조회 실패' },
      });
    }

    // 회원별 주문 통계 집계 (별도 쿼리)
    const emails = (members ?? []).map((m: { email: string }) => m.email).filter(Boolean);
    const orderStatsMap = new Map<string, { order_count: number; total_spent: number }>();

    if (emails.length > 0) {
      const { data: orderStats } = await supabase
        .from('orders')
        .select('customer_email, total_amount')
        .in('customer_email' as never, emails as never);

      if (orderStats) {
        for (const row of orderStats as Array<{ customer_email: string; total_amount?: number }>) {
          const existing = orderStatsMap.get(row.customer_email) ?? { order_count: 0, total_spent: 0 };
          existing.order_count += 1;
          existing.total_spent += row.total_amount ?? 0;
          orderStatsMap.set(row.customer_email, existing);
        }
      }
    }

    // 회원 데이터에 통계 병합
    const membersWithStats = (members ?? []).map((m: { email: string }) => {
      const stats = orderStatsMap.get(m.email) ?? { order_count: 0, total_spent: 0 };
      return {
        ...m,
        order_count: stats.order_count,
        total_spent: stats.total_spent,
      };
    });

    return jsonResponse(200, {
      success: true,
      data: {
        members: membersWithStats,
        totalCount: count ?? 0,
        page,
        pageSize,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return jsonResponse(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
    });
  }
};

// ─── PATCH: 회원 상태/메모 수정 ─────────────────────
export const PATCH: APIRoute = async ({ request }) => {
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();
    const { member_id, status, admin_notes } = body as {
      member_id?: string;
      status?: string;
      admin_notes?: string;
    };

    if (!member_id) {
      return jsonResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'member_id는 필수입니다' },
      });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status !== undefined) {
      const allowedStatuses = ['active', 'suspended', 'withdrawn'];
      if (!allowedStatuses.includes(status)) {
        return jsonResponse(400, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 상태입니다' },
        });
      }
      updates.status = status;
    }

    if (admin_notes !== undefined) {
      updates.admin_notes = admin_notes;
    }

    if (Object.keys(updates).length <= 1) {
      return jsonResponse(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '변경할 내용이 없습니다' },
      });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates as never)
      .eq('id' as never, member_id as never)
      .select()
      .single();

    if (error || !data) {
      return jsonResponse(500, {
        success: false,
        error: { code: 'UPDATE_ERROR', message: '회원 정보 업데이트 실패' },
      });
    }

    return jsonResponse(200, {
      success: true,
      data,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
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
