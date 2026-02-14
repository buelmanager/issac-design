import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { DataTable, SearchInput, StatusBadge, Pagination, LoadingSpinner, EmptyState } from '../ui';
import toast from 'react-hot-toast';
import {
  CreditCard, RefreshCw, Eye, X, ArrowLeft,
  AlertTriangle, CheckCircle, Clock, XCircle, RotateCcw,
  Activity, FileText, Filter, TrendingUp, ChevronDown,
} from 'lucide-react';

// ─── 타입 ────────────────────────────────────────
interface PaymentRow {
  id: string;
  order_id: string;
  idempotency_key: string;
  amount: number;
  currency: string;
  status: string;
  pg_provider: string | null;
  pg_payment_id: string | null;
  pg_response: Record<string, unknown>;
  method: string | null;
  failed_reason: string | null;
  paid_at: string | null;
  canceled_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
  orders?: OrderRow;
}

interface OrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  business_name: string | null;
  items: unknown[];
  total_amount: number;
  status: string;
  created_at: string;
}

interface StatusLogRow {
  id: string;
  payment_id: string;
  from_status: string;
  to_status: string;
  reason: string | null;
  actor: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

type ViewMode = 'list' | 'detail' | 'logs';

const PAGE_SIZE = 20;

// ─── 상태 정의 ───────────────────────────────────
const PAYMENT_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle;
}> = {
  INIT: { label: '초기화', color: '#6B7280', bgColor: '#F3F4F6', icon: Clock },
  PENDING: { label: '결제 대기', color: '#D97706', bgColor: '#FEF3C7', icon: Clock },
  PAID: { label: '결제 완료', color: '#059669', bgColor: '#D1FAE5', icon: CheckCircle },
  FAILED: { label: '결제 실패', color: '#DC2626', bgColor: '#FEE2E2', icon: XCircle },
  CANCELED: { label: '취소됨', color: '#6B7280', bgColor: '#F3F4F6', icon: XCircle },
  REFUND_PENDING: { label: '환불 대기', color: '#D97706', bgColor: '#FEF3C7', icon: RotateCcw },
  REFUNDED: { label: '환불 완료', color: '#7C3AED', bgColor: '#EDE9FE', icon: RotateCcw },
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '결제 대기',
  paid: '결제 완료',
  processing: '제작 중',
  shipped: '배송 중',
  delivered: '배송 완료',
  canceled: '취소됨',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'INIT', label: '초기화' },
  { value: 'PENDING', label: '결제 대기' },
  { value: 'PAID', label: '결제 완료' },
  { value: 'FAILED', label: '결제 실패' },
  { value: 'CANCELED', label: '취소됨' },
  { value: 'REFUND_PENDING', label: '환불 대기' },
  { value: 'REFUNDED', label: '환불 완료' },
];

const LOG_LEVEL_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  INFO: { label: 'INFO', color: '#2563EB', bgColor: '#DBEAFE' },
  WARN: { label: 'WARN', color: '#D97706', bgColor: '#FEF3C7' },
  ERROR: { label: 'ERROR', color: '#DC2626', bgColor: '#FEE2E2' },
  CRITICAL: { label: 'CRITICAL', color: '#FFFFFF', bgColor: '#DC2626' },
};

// ─── 유틸 ────────────────────────────────────────
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatAmount(amount: number, currency = 'KRW'): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ─── 컴포넌트 ────────────────────────────────────
export default function PaymentsPage() {
  const [view, setView] = useState<ViewMode>('list');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLogRow[]>([]);
  const [systemLogs, setSystemLogs] = useState<unknown[]>([]);
  const [logStats, setLogStats] = useState<{ total: number; by_level: Record<string, number>; recent_errors: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [logFilter, setLogFilter] = useState<{ level: string; view: string }>({ level: 'all', view: 'all' });

  // ─── 결제 목록 조회 ─────────────────────────
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('payments')
        .select('*, orders(*)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (search) {
        query = query.or(`pg_payment_id.ilike.%${search}%,idempotency_key.ilike.%${search}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      setPayments((data ?? []) as unknown as PaymentRow[]);
      setTotalCount(count ?? 0);
    } catch (err) {
      toast.error('결제 목록 조회 실패');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // ─── 결제 상세 조회 ─────────────────────────
  const openDetail = async (payment: PaymentRow) => {
    setSelectedPayment(payment);
    setView('detail');

    // 상태 변경 로그 조회
    const { data: logs } = await supabase
      .from('payment_status_logs')
      .select('*')
      .eq('payment_id', payment.id)
      .order('created_at', { ascending: true });

    setStatusLogs((logs ?? []) as unknown as StatusLogRow[]);
  };

  // ─── 시스템 로그 조회 ───────────────────────
  const openLogs = async () => {
    setView('logs');
    await fetchSystemLogs();
    await fetchLogStats();
  };

  const fetchSystemLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (logFilter.level !== 'all') params.set('level', logFilter.level);
      if (logFilter.view !== 'all') params.set('view', logFilter.view);
      params.set('limit', '100');

      const res = await fetch(`/api/payment/logs?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSystemLogs(json.data.logs ?? []);
      }
    } catch {
      toast.error('시스템 로그 조회 실패');
    }
  };

  const fetchLogStats = async () => {
    try {
      const res = await fetch('/api/payment/logs?view=stats');
      const json = await res.json();
      if (json.success) {
        setLogStats(json.data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (view === 'logs') fetchSystemLogs();
  }, [logFilter]);

  // ─── 결제 상태 배지 ─────────────────────────
  const PaymentStatusBadge = ({ status }: { status: string }) => {
    const config = PAYMENT_STATUS_CONFIG[status] ?? PAYMENT_STATUS_CONFIG.INIT;
    const Icon = config.icon;
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600,
          color: config.color, backgroundColor: config.bgColor,
        }}
      >
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  // ═══════════════════════════════════════════════
  // 메인 뷰: 결제 목록
  // ═══════════════════════════════════════════════
  if (view === 'list') {
    return (
      <div style={{ padding: '24px' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>결제 관리</h1>
            <p style={{ color: '#6B7280', margin: '4px 0 0', fontSize: '14px' }}>
              전체 {totalCount}건의 결제 내역
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={openLogs}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                border: '1px solid #E5E7EB', backgroundColor: '#fff',
                fontSize: '14px', cursor: 'pointer',
              }}
            >
              <Activity size={16} />
              시스템 로그
            </button>
            <button
              onClick={fetchPayments}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                border: 'none', backgroundColor: '#111827', color: '#fff',
                fontSize: '14px', cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} />
              새로고침
            </button>
          </div>
        </div>

        {/* 필터 바 */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                style={{
                  padding: '6px 14px', borderRadius: '9999px', fontSize: '13px',
                  border: statusFilter === opt.value ? '2px solid #111827' : '1px solid #E5E7EB',
                  backgroundColor: statusFilter === opt.value ? '#111827' : '#fff',
                  color: statusFilter === opt.value ? '#fff' : '#374151',
                  cursor: 'pointer', fontWeight: statusFilter === opt.value ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <SearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder="PG 결제 ID, 멱등키로 검색..."
            />
          </div>
        </div>

        {/* 테이블 */}
        {loading ? (
          <LoadingSpinner />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={48} />}
            title="결제 내역이 없습니다"
            description="아직 결제가 진행되지 않았습니다."
          />
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #E5E7EB', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>주문번호</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>고객</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>금액</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>결제 상태</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>PG</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>결제 수단</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>생성일</th>
                    <th style={{ padding: '12px 8px', fontWeight: 600, color: '#6B7280' }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                      onClick={() => openDetail(p)}
                    >
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>
                          {p.orders?.order_number ?? '-'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div>{p.orders?.customer_name ?? '-'}</div>
                        <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{p.orders?.business_name ?? ''}</div>
                      </td>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                        {formatAmount(p.amount, p.currency)}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <PaymentStatusBadge status={p.status} />
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '12px', color: '#6B7280' }}>
                        {p.pg_provider ?? '-'}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '12px' }}>
                        {p.method ?? '-'}
                      </td>
                      <td style={{ padding: '12px 8px', fontSize: '12px', color: '#6B7280' }}>
                        {getRelativeTime(p.created_at)}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetail(p); }}
                          style={{
                            padding: '4px 8px', borderRadius: '6px',
                            border: '1px solid #E5E7EB', backgroundColor: '#fff',
                            fontSize: '12px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          <Eye size={14} /> 상세
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '16px' }}>
              <Pagination
                currentPage={page}
                totalPages={Math.ceil(totalCount / PAGE_SIZE)}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // 상세 뷰: 결제 상세 + 상태 타임라인
  // ═══════════════════════════════════════════════
  if (view === 'detail' && selectedPayment) {
    const p = selectedPayment;
    const order = p.orders;

    return (
      <div style={{ padding: '24px' }}>
        {/* 헤더 */}
        <button
          onClick={() => setView('list')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 0', border: 'none', backgroundColor: 'transparent',
            fontSize: '14px', cursor: 'pointer', color: '#6B7280', marginBottom: '16px',
          }}
        >
          <ArrowLeft size={16} /> 목록으로
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
              결제 상세 - {order?.order_number ?? ''}
            </h1>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '4px 0 0' }}>
              Payment ID: <code style={{ fontSize: '12px', backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>{p.id}</code>
            </p>
          </div>
          <PaymentStatusBadge status={p.status} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* 좌: 결제 정보 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 결제 정보 카드 */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} /> 결제 정보
              </h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <InfoRow label="결제 금액" value={formatAmount(p.amount, p.currency)} highlight />
                <InfoRow label="결제 수단" value={p.method ?? '-'} />
                <InfoRow label="PG사" value={p.pg_provider ?? '-'} />
                <InfoRow label="PG 결제 ID" value={p.pg_payment_id ?? '-'} mono />
                <InfoRow label="멱등키" value={p.idempotency_key} mono />
                <InfoRow label="생성일시" value={formatDateTime(p.created_at)} />
                {p.paid_at && <InfoRow label="결제일시" value={formatDateTime(p.paid_at)} />}
                {p.canceled_at && <InfoRow label="취소일시" value={formatDateTime(p.canceled_at)} />}
                {p.refunded_at && <InfoRow label="환불일시" value={formatDateTime(p.refunded_at)} />}
                {p.failed_reason && <InfoRow label="실패 사유" value={p.failed_reason} error />}
              </div>
            </div>

            {/* 주문 정보 카드 */}
            {order && (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} /> 주문 정보
                </h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <InfoRow label="주문번호" value={order.order_number} mono />
                  <InfoRow label="고객명" value={order.customer_name} />
                  <InfoRow label="연락처" value={order.customer_phone} />
                  <InfoRow label="이메일" value={order.customer_email ?? '-'} />
                  <InfoRow label="업체명" value={order.business_name ?? '-'} />
                  <InfoRow label="주문 상태" value={ORDER_STATUS_LABELS[order.status] ?? order.status} />
                  <InfoRow label="주문 금액" value={formatAmount(order.total_amount)} />
                </div>
              </div>
            )}

            {/* PG 원본 응답 */}
            {p.pg_response && Object.keys(p.pg_response).length > 0 && (
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>PG 원본 응답</h3>
                <pre style={{
                  backgroundColor: '#1F2937', color: '#D1D5DB', padding: '16px',
                  borderRadius: '8px', fontSize: '12px', overflow: 'auto', maxHeight: '300px',
                  fontFamily: 'monospace', lineHeight: 1.6,
                }}>
                  {JSON.stringify(p.pg_response, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* 우: 상태 변경 타임라인 */}
          <div>
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} /> 상태 변경 타임라인
              </h3>

              {statusLogs.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
                  상태 변경 기록이 없습니다
                </p>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '24px' }}>
                  {/* 타임라인 라인 */}
                  <div style={{
                    position: 'absolute', left: '8px', top: '4px', bottom: '4px',
                    width: '2px', backgroundColor: '#E5E7EB',
                  }} />

                  {statusLogs.map((log, i) => {
                    const toConfig = PAYMENT_STATUS_CONFIG[log.to_status] ?? PAYMENT_STATUS_CONFIG.INIT;
                    return (
                      <div key={log.id} style={{ position: 'relative', marginBottom: i < statusLogs.length - 1 ? '24px' : '0' }}>
                        {/* 타임라인 도트 */}
                        <div style={{
                          position: 'absolute', left: '-20px', top: '2px',
                          width: '12px', height: '12px', borderRadius: '50%',
                          backgroundColor: toConfig.color, border: '2px solid #fff',
                          boxShadow: '0 0 0 2px ' + toConfig.color + '33',
                        }} />

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <PaymentStatusBadge status={log.from_status} />
                            <span style={{ color: '#9CA3AF', fontSize: '14px' }}>→</span>
                            <PaymentStatusBadge status={log.to_status} />
                          </div>
                          <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                            <span>{formatDateTime(log.created_at)}</span>
                            <span style={{ margin: '0 6px' }}>|</span>
                            <span style={{
                              backgroundColor: '#F3F4F6', padding: '1px 6px',
                              borderRadius: '4px', fontFamily: 'monospace',
                            }}>
                              {log.actor}
                            </span>
                          </div>
                          {log.reason && (
                            <div style={{
                              marginTop: '6px', padding: '8px 12px', backgroundColor: '#F9FAFB',
                              borderRadius: '6px', fontSize: '13px', color: '#374151',
                            }}>
                              {log.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // 시스템 로그 뷰
  // ═══════════════════════════════════════════════
  if (view === 'logs') {
    return (
      <div style={{ padding: '24px' }}>
        {/* 헤더 */}
        <button
          onClick={() => setView('list')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 0', border: 'none', backgroundColor: 'transparent',
            fontSize: '14px', cursor: 'pointer', color: '#6B7280', marginBottom: '16px',
          }}
        >
          <ArrowLeft size={16} /> 결제 관리로
        </button>

        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>결제 시스템 로그</h1>

        {/* 로그 통계 카드 */}
        {logStats && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px',
            marginBottom: '24px',
          }}>
            <StatCard label="전체 로그" value={logStats.total} color="#111827" />
            <StatCard label="INFO" value={logStats.by_level.INFO ?? 0} color="#2563EB" />
            <StatCard label="WARN" value={logStats.by_level.WARN ?? 0} color="#D97706" />
            <StatCard label="ERROR" value={logStats.by_level.ERROR ?? 0} color="#DC2626" />
            <StatCard
              label="최근 1시간 오류"
              value={logStats.recent_errors}
              color={logStats.recent_errors > 0 ? '#DC2626' : '#059669'}
              alert={logStats.recent_errors > 0}
            />
          </div>
        )}

        {/* 로그 필터 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['all', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLogFilter((prev) => ({ ...prev, level: lvl }))}
                style={{
                  padding: '6px 12px', borderRadius: '9999px', fontSize: '12px',
                  border: logFilter.level === lvl ? '2px solid #111827' : '1px solid #E5E7EB',
                  backgroundColor: logFilter.level === lvl ? '#111827' : '#fff',
                  color: logFilter.level === lvl ? '#fff' : '#374151',
                  cursor: 'pointer', fontWeight: logFilter.level === lvl ? 600 : 400,
                }}
              >
                {lvl === 'all' ? '전체' : lvl}
              </button>
            ))}
          </div>
          <button
            onClick={fetchSystemLogs}
            style={{
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid #E5E7EB', backgroundColor: '#fff',
              fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>

        {/* 로그 테이블 */}
        <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: '160px' }}>시간</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: '80px' }}>레벨</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>액션</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: '120px' }}>Payment</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>상세</th>
              </tr>
            </thead>
            <tbody>
              {(systemLogs as Array<{
                timestamp: string;
                level: string;
                action: string;
                payment_id?: string;
                order_id?: string;
                details: Record<string, unknown>;
                error?: string;
              }>).map((log, i) => {
                const levelConfig = LOG_LEVEL_CONFIG[log.level] ?? LOG_LEVEL_CONFIG.INFO;
                return (
                  <tr key={i} style={{
                    borderBottom: '1px solid #F3F4F6',
                    backgroundColor: log.level === 'CRITICAL' ? '#FEF2F2' : log.level === 'ERROR' ? '#FFFBEB' : 'transparent',
                  }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#6B7280' }}>
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '4px',
                        fontSize: '11px', fontWeight: 700, fontFamily: 'monospace',
                        color: levelConfig.color, backgroundColor: levelConfig.bgColor,
                      }}>
                        {log.level}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                      {log.action}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#6B7280' }}>
                      {log.payment_id ? log.payment_id.slice(0, 8) + '...' : '-'}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: '#6B7280', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.error ? (
                        <span style={{ color: '#DC2626' }}>{log.error}</span>
                      ) : (
                        JSON.stringify(log.details).slice(0, 100)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {systemLogs.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
              로그가 없습니다
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── 서브 컴포넌트 ─────────────────────────────

function InfoRow({ label, value, mono, highlight, error }: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  error?: boolean;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: '#6B7280' }}>{label}</span>
      <span style={{
        fontSize: highlight ? '16px' : '13px',
        fontWeight: highlight ? 700 : 500,
        fontFamily: mono ? 'monospace' : 'inherit',
        color: error ? '#DC2626' : highlight ? '#111827' : '#374151',
        maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  );
}

function StatCard({ label, value, color, alert }: {
  label: string;
  value: number;
  color: string;
  alert?: boolean;
}) {
  return (
    <div style={{
      border: alert ? '2px solid #DC2626' : '1px solid #E5E7EB',
      borderRadius: '12px', padding: '16px',
      backgroundColor: alert ? '#FEF2F2' : '#fff',
    }}>
      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
