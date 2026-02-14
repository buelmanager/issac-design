import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SearchInput, Pagination, LoadingSpinner, EmptyState } from '../ui';
import toast from 'react-hot-toast';
import {
  CreditCard, RefreshCw, Eye, ArrowLeft,
  CheckCircle, Clock, XCircle, RotateCcw,
  Activity, FileText, Search, ChevronDown, ChevronRight, Timer, Download,
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

interface SystemLogEntry {
  timestamp: string;
  level: string;
  action: string;
  payment_id?: string;
  order_id?: string;
  request_id?: string;
  details: Record<string, unknown>;
  error?: string;
  stack?: string;
  duration_ms?: number;
  actor_ip?: string;
  http_method?: string;
  http_path?: string;
  http_status?: number;
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

const DATE_RANGE_PRESETS = [
  { label: '1시간', value: 1 },
  { label: '24시간', value: 24 },
  { label: '7일', value: 24 * 7 },
  { label: '30일', value: 24 * 30 },
  { label: '전체', value: 0 },
];

const AUTO_REFRESH_OPTIONS = [
  { label: '꺼짐', value: 0 },
  { label: '10초', value: 10 },
  { label: '30초', value: 30 },
  { label: '60초', value: 60 },
];

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

const relativeFormatter = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return relativeFormatter.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return relativeFormatter.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return relativeFormatter.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  return relativeFormatter.format(-days, 'day');
}

// ─── 상태 배지 (컴포넌트 외부 정의 - 불필요한 재생성 방지) ──
function PaymentStatusBadge({ status }: { status: string }) {
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
      <Icon size={12} aria-hidden="true" />
      {config.label}
    </span>
  );
}

// ─── 로그 내보내기 헬퍼 ──────────────────────────
function getLogValue(log: SystemLogEntry, key: string): string {
  switch(key) {
    case 'timestamp': return log.timestamp ?? '';
    case 'level': return log.level ?? '';
    case 'action': return log.action ?? '';
    case 'duration_ms': return log.duration_ms != null ? String(log.duration_ms) : '';
    case 'request_id': return log.request_id ?? '';
    case 'payment_id': return log.payment_id ?? '';
    case 'order_id': return log.order_id ?? '';
    case 'error': return log.error ?? '';
    case 'http_method': return log.http_method ?? '';
    case 'http_path': return log.http_path ?? '';
    case 'http_status': return log.http_status != null ? String(log.http_status) : '';
    case 'actor_ip': return log.actor_ip ?? '';
    default: return '';
  }
}

// ─── 컴포넌트 ────────────────────────────────────
export default function PaymentsPage() {
  const { accessToken } = useAuth();
  const [view, setView] = useState<ViewMode>('list');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(null);
  const [statusLogs, setStatusLogs] = useState<StatusLogRow[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [logStats, setLogStats] = useState<{
    total: number;
    by_level: Record<string, number>;
    recent_errors: number;
    avg_api_duration_ms?: number;
    pg_call_count?: number;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // 로그 관련 상태
  const [logFilter, setLogFilter] = useState<{ level: string; view: string }>({ level: 'all', view: 'all' });
  const [logSearch, setLogSearch] = useState('');
  const [logDateRange, setLogDateRange] = useState(0); // hours, 0 = all
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 결제 상세 - 시스템 로그 탭
  const [detailTab, setDetailTab] = useState<'timeline' | 'systemlogs'>('timeline');
  const [detailSystemLogs, setDetailSystemLogs] = useState<SystemLogEntry[]>([]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/admin/payments?${params.toString()}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error?.message ?? 'Unknown error');

      setPayments(json.data.payments as PaymentRow[]);
      setTotalCount(json.data.totalCount ?? 0);
    } catch (err) {
      toast.error('결제 목록 조회 실패');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, accessToken]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // ─── 결제 상세 조회 ─────────────────────────
  const openDetail = async (payment: PaymentRow) => {
    setSelectedPayment(payment);
    setView('detail');
    setDetailTab('timeline');

    try {
      const res = await fetch(`/api/admin/payments?payment_id=${payment.id}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();

      if (json.success) {
        setStatusLogs(json.data.statusLogs as StatusLogRow[]);
      }
    } catch {
      toast.error('결제 상세 조회 실패');
    }
  };

  // ─── 결제 상세 - 시스템 로그 탭 ───────────────
  const fetchDetailSystemLogs = useCallback(async (paymentId: string) => {
    try {
      const params = new URLSearchParams({
        payment_id: paymentId,
        limit: '100',
      });
      const res = await fetch(`/api/payment/logs?${params.toString()}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (json.success) {
        setDetailSystemLogs(json.data.logs ?? []);
      }
    } catch {
      toast.error('시스템 로그 조회 실패');
    }
  }, [accessToken]);

  // 탭 변경 시 시스템 로그 로드
  useEffect(() => {
    if (detailTab === 'systemlogs' && selectedPayment) {
      fetchDetailSystemLogs(selectedPayment.id);
    }
  }, [detailTab, selectedPayment, fetchDetailSystemLogs]);

  // ─── 시스템 로그 조회 ───────────────────────
  const openLogs = async () => {
    setView('logs');
    await fetchSystemLogs();
    await fetchLogStats();
  };

  const fetchSystemLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (logFilter.level !== 'all') params.set('level', logFilter.level);
      if (logFilter.view !== 'all') params.set('view', logFilter.view);
      if (logSearch) params.set('search', logSearch);
      if (logDateRange > 0) {
        const from = new Date(Date.now() - logDateRange * 60 * 60 * 1000).toISOString();
        params.set('from', from);
      }
      params.set('limit', '100');

      const res = await fetch(`/api/payment/logs?${params.toString()}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (json.success) {
        setSystemLogs(json.data.logs ?? []);
      }
    } catch {
      toast.error('시스템 로그 조회 실패');
    }
  }, [logFilter, logSearch, logDateRange, accessToken]);

  const fetchLogStats = async () => {
    try {
      const res = await fetch('/api/payment/logs?view=stats', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (json.success) {
        setLogStats(json.data);
      }
    } catch {
      // ignore
    }
  };

  const exportLogs = useCallback((format: 'json' | 'csv') => {
    if (systemLogs.length === 0) {
      toast.error('내보낼 로그가 없습니다');
      return;
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let content: string;
    let mimeType: string;

    if (format === 'json') {
      content = JSON.stringify(systemLogs, null, 2);
      mimeType = 'application/json';
    } else {
      const headers = ['timestamp', 'level', 'action', 'duration_ms', 'request_id', 'payment_id', 'order_id', 'error', 'http_method', 'http_path', 'http_status', 'actor_ip'];
      const rows = systemLogs.map(log => 
        headers.map(h => {
          const val = getLogValue(log, h);
          return val.includes(',') || val.includes('"') || val.includes('\n') 
            ? `"${val.replace(/"/g, '""')}"` 
            : val;
        }).join(',')
      );
      content = [headers.join(','), ...rows].join('\n');
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${dateStr}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`로그를 ${format.toUpperCase()} 파일로 저장했습니다`);
  }, [systemLogs]);

  useEffect(() => {
    if (view === 'logs') fetchSystemLogs();
  }, [logFilter, fetchSystemLogs, view]);

  // ─── 자동 새로고침 ─────────────────────────
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (autoRefreshInterval > 0 && view === 'logs') {
      autoRefreshRef.current = setInterval(() => {
        fetchSystemLogs();
        fetchLogStats();
      }, autoRefreshInterval * 1000);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefreshInterval, view, fetchSystemLogs]);

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
              aria-label="결제 시스템 로그 보기"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                border: '1px solid #E5E7EB', backgroundColor: '#fff',
                fontSize: '14px', cursor: 'pointer',
              }}
            >
              <Activity size={16} aria-hidden="true" />
              시스템 로그
            </button>
            <button
              onClick={fetchPayments}
              aria-label="결제 목록 새로고침"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', borderRadius: '8px',
                border: 'none', backgroundColor: '#111827', color: '#fff',
                fontSize: '14px', cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
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
              placeholder="PG 결제 ID, 멱등키로 검색\u2026"
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
                      role="row"
                      tabIndex={0}
                      aria-label={`결제 ${p.orders?.order_number ?? ''} - ${formatAmount(p.amount, p.currency)}`}
                      style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}
                      onClick={() => openDetail(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(p); } }}
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
                      <td style={{ padding: '12px 8px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
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
                          aria-label={`${p.orders?.order_number ?? '결제'} 상세 보기`}
                          style={{
                            padding: '4px 8px', borderRadius: '6px',
                            border: '1px solid #E5E7EB', backgroundColor: '#fff',
                            fontSize: '12px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                          }}
                        >
                          <Eye size={14} aria-hidden="true" /> 상세
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
  // 상세 뷰: 결제 상세 + 상태 타임라인 + 시스템 로그
  // ═══════════════════════════════════════════════
  if (view === 'detail' && selectedPayment) {
    const p = selectedPayment;
    const order = p.orders;

    return (
      <div style={{ padding: '24px' }}>
        {/* 헤더 */}
        <button
          onClick={() => setView('list')}
          aria-label="결제 목록으로 돌아가기"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 0', border: 'none', backgroundColor: 'transparent',
            fontSize: '14px', cursor: 'pointer', color: '#6B7280', marginBottom: '16px',
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" /> 목록으로
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

          {/* 우: 탭 전환 - 타임라인 / 시스템 로그 */}
          <div>
            {/* 탭 헤더 */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
              <button
                onClick={() => setDetailTab('timeline')}
                style={{
                  padding: '8px 16px', borderRadius: '8px 8px 0 0', fontSize: '14px', fontWeight: 600,
                  border: '1px solid #E5E7EB', borderBottom: detailTab === 'timeline' ? '2px solid #111827' : '1px solid #E5E7EB',
                  backgroundColor: detailTab === 'timeline' ? '#fff' : '#F9FAFB',
                  color: detailTab === 'timeline' ? '#111827' : '#6B7280',
                  cursor: 'pointer',
                }}
              >
                <Activity size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} aria-hidden="true" />
                상태 타임라인
              </button>
              <button
                onClick={() => setDetailTab('systemlogs')}
                style={{
                  padding: '8px 16px', borderRadius: '8px 8px 0 0', fontSize: '14px', fontWeight: 600,
                  border: '1px solid #E5E7EB', borderBottom: detailTab === 'systemlogs' ? '2px solid #111827' : '1px solid #E5E7EB',
                  backgroundColor: detailTab === 'systemlogs' ? '#fff' : '#F9FAFB',
                  color: detailTab === 'systemlogs' ? '#111827' : '#6B7280',
                  cursor: 'pointer',
                }}
              >
                <FileText size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} aria-hidden="true" />
                시스템 로그
              </button>
            </div>

            {/* 탭 컨텐츠 */}
            {detailTab === 'timeline' ? (
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
                    <div style={{
                      position: 'absolute', left: '8px', top: '4px', bottom: '4px',
                      width: '2px', backgroundColor: '#E5E7EB',
                    }} />

                    {statusLogs.map((log, i) => {
                      const toConfig = PAYMENT_STATUS_CONFIG[log.to_status] ?? PAYMENT_STATUS_CONFIG.INIT;
                      return (
                        <div key={log.id} style={{ position: 'relative', marginBottom: i < statusLogs.length - 1 ? '24px' : '0' }}>
                          <div style={{
                            position: 'absolute', left: '-20px', top: '2px',
                            width: '12px', height: '12px', borderRadius: '50%',
                            backgroundColor: toConfig.color, border: '2px solid #fff',
                            boxShadow: '0 0 0 2px ' + toConfig.color + '33',
                          }} />

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <PaymentStatusBadge status={log.from_status} />
                              <span style={{ color: '#9CA3AF', fontSize: '14px' }}>\u2192</span>
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
            ) : (
              /* 시스템 로그 탭 */
              <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} /> 이 결제의 시스템 로그
                </h3>

                {detailSystemLogs.length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
                    시스템 로그가 없습니다
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {detailSystemLogs.map((log, i) => {
                      const levelConfig = LOG_LEVEL_CONFIG[log.level] ?? LOG_LEVEL_CONFIG.INFO;
                      return (
                        <div
                          key={`${log.timestamp}-${log.action}-${i}`}
                          style={{
                            padding: '10px 12px', borderRadius: '8px', fontSize: '12px',
                            backgroundColor: log.level === 'CRITICAL' ? '#FEF2F2' : log.level === 'ERROR' ? '#FFF7ED' : '#F9FAFB',
                            border: '1px solid #E5E7EB',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{
                              padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                              color: levelConfig.color, backgroundColor: levelConfig.bgColor,
                            }}>
                              {log.level}
                            </span>
                            <span style={{ fontWeight: 600 }}>{log.action}</span>
                            {log.duration_ms != null && (
                              <span style={{ color: '#6B7280', fontFamily: 'monospace' }}>{log.duration_ms}ms</span>
                            )}
                            <span style={{ color: '#9CA3AF', marginLeft: 'auto', fontFamily: 'monospace' }}>
                              {getRelativeTime(log.timestamp)}
                            </span>
                          </div>
                          {log.error && (
                            <div style={{ color: '#DC2626', fontSize: '11px', marginTop: '2px' }}>{log.error}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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
          onClick={() => { setView('list'); setAutoRefreshInterval(0); }}
          aria-label="결제 관리 목록으로 돌아가기"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 0', border: 'none', backgroundColor: 'transparent',
            fontSize: '14px', cursor: 'pointer', color: '#6B7280', marginBottom: '16px',
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" /> 결제 관리로
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>결제 시스템 로그</h1>
          {/* 자동 새로고침 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Timer size={14} aria-hidden="true" style={{ color: '#6B7280' }} />
            <span style={{ fontSize: '12px', color: '#6B7280' }}>자동 새로고침:</span>
            {AUTO_REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setAutoRefreshInterval(opt.value)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
                  border: autoRefreshInterval === opt.value ? '2px solid #059669' : '1px solid #E5E7EB',
                  backgroundColor: autoRefreshInterval === opt.value ? '#D1FAE5' : '#fff',
                  color: autoRefreshInterval === opt.value ? '#059669' : '#6B7280',
                  cursor: 'pointer', fontWeight: autoRefreshInterval === opt.value ? 600 : 400,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 로그 통계 카드 - 반응형 그리드 */}
        {logStats && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
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
            {logStats.avg_api_duration_ms != null && (
              <StatCard label="평균 API 응답" value={logStats.avg_api_duration_ms} color="#7C3AED" suffix="ms" />
            )}
            {logStats.pg_call_count != null && (
              <StatCard label="PG 호출 수" value={logStats.pg_call_count} color="#0891B2" />
            )}
          </div>
        )}

        {/* 로그 필터 바 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 레벨 필터 */}
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

          {/* 구분선 */}
          <div style={{ width: '1px', height: '24px', backgroundColor: '#E5E7EB' }} />

          {/* 날짜 범위 프리셋 */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setLogDateRange(preset.value)}
                style={{
                  padding: '6px 10px', borderRadius: '6px', fontSize: '11px',
                  border: logDateRange === preset.value ? '2px solid #6366F1' : '1px solid #E5E7EB',
                  backgroundColor: logDateRange === preset.value ? '#EEF2FF' : '#fff',
                  color: logDateRange === preset.value ? '#4338CA' : '#6B7280',
                  cursor: 'pointer', fontWeight: logDateRange === preset.value ? 600 : 400,
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* 구분선 */}
          <div style={{ width: '1px', height: '24px', backgroundColor: '#E5E7EB' }} />

          <button
            onClick={() => { fetchSystemLogs(); fetchLogStats(); }}
            aria-label="시스템 로그 새로고침"
            style={{
              padding: '6px 12px', borderRadius: '8px',
              border: '1px solid #E5E7EB', backgroundColor: '#fff',
              fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <RefreshCw size={12} aria-hidden="true" /> 새로고침
          </button>

          {/* 구분선 */}
          <div style={{ width: '1px', height: '24px', backgroundColor: '#E5E7EB' }} />

          {/* 내보내기 */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => exportLogs('json')}
              aria-label="로그를 JSON 파일로 내보내기"
              style={{
                padding: '6px 12px', borderRadius: '8px',
                border: '1px solid #E5E7EB', backgroundColor: '#fff',
                fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <Download size={12} aria-hidden="true" /> JSON
            </button>
            <button
              onClick={() => exportLogs('csv')}
              aria-label="로그를 CSV 파일로 내보내기"
              style={{
                padding: '6px 12px', borderRadius: '8px',
                border: '1px solid #E5E7EB', backgroundColor: '#fff',
                fontSize: '12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}
            >
              <Download size={12} aria-hidden="true" /> CSV
            </button>
          </div>
        </div>

        {/* 검색 바 */}
        <div style={{ marginBottom: '16px', maxWidth: '400px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} aria-hidden="true" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') fetchSystemLogs(); }}
              placeholder="action, error, payment_id, request_id\u2026"
              aria-label="로그 검색"
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: '8px',
                border: '1px solid #E5E7EB', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* 로그 테이블 */}
        <div style={{ border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: '#6B7280', width: '28px' }} />
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: '160px' }}>시간</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: '80px' }}>레벨</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>액션</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: '80px' }}>소요시간</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280', width: '100px' }}>Request</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6B7280' }}>요약</th>
              </tr>
            </thead>
            <tbody>
              {systemLogs.map((log, i) => {
                const levelConfig = LOG_LEVEL_CONFIG[log.level] ?? LOG_LEVEL_CONFIG.INFO;
                const isExpanded = expandedLogIndex === i;
                return (
                  <>
                    <tr
                      key={`${log.timestamp}-${log.action}-${i}`}
                      role="row"
                      tabIndex={0}
                      aria-label={`${log.level} ${log.action}`}
                      onClick={() => setExpandedLogIndex(isExpanded ? null : i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedLogIndex(isExpanded ? null : i); } }}
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid #F3F4F6',
                        backgroundColor: log.level === 'CRITICAL' ? '#FEF2F2' : log.level === 'ERROR' ? '#FFFBEB' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        {isExpanded
                          ? <ChevronDown size={14} aria-hidden="true" style={{ color: '#6B7280' }} />
                          : <ChevronRight size={14} aria-hidden="true" style={{ color: '#9CA3AF' }} />
                        }
                      </td>
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
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#6B7280', fontVariantNumeric: 'tabular-nums' }}>
                        {log.duration_ms != null ? `${log.duration_ms}ms` : '-'}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#6B7280' }}>
                        {log.request_id ? log.request_id.slice(0, 8) + '\u2026' : '-'}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '12px', color: '#6B7280', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.error ? (
                          <span style={{ color: '#DC2626' }}>{log.error}</span>
                        ) : (
                          JSON.stringify(log.details).slice(0, 80)
                        )}
                      </td>
                    </tr>
                    {/* 확장된 상세 정보 */}
                    {isExpanded && (
                      <tr key={`expanded-${i}`} style={{ borderBottom: '1px solid #E5E7EB' }}>
                        <td colSpan={7} style={{ padding: '0 12px 16px 40px' }}>
                          <div style={{
                            backgroundColor: '#F9FAFB', borderRadius: '8px', padding: '16px',
                            border: '1px solid #E5E7EB',
                          }}>
                            {/* 메타 정보 */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: log.error || Object.keys(log.details).length > 0 ? '12px' : '0' }}>
                              {log.request_id && (
                                <MetaItem label="Request ID" value={log.request_id} />
                              )}
                              {log.payment_id && (
                                <MetaItem label="Payment ID" value={log.payment_id} />
                              )}
                              {log.order_id && (
                                <MetaItem label="Order ID" value={log.order_id} />
                              )}
                              {log.http_method && (
                                <MetaItem label="HTTP" value={`${log.http_method} ${log.http_path ?? ''} → ${log.http_status ?? ''}`} />
                              )}
                              {log.actor_ip && (
                                <MetaItem label="IP" value={log.actor_ip} />
                              )}
                              {log.duration_ms != null && (
                                <MetaItem label="소요시간" value={`${log.duration_ms}ms`} />
                              )}
                            </div>

                            {/* 에러 메시지 */}
                            {log.error && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#DC2626', marginBottom: '4px' }}>Error</div>
                                <div style={{
                                  padding: '8px 12px', backgroundColor: '#FEF2F2', borderRadius: '6px',
                                  fontSize: '12px', color: '#991B1B', fontFamily: 'monospace',
                                }}>
                                  {log.error}
                                </div>
                              </div>
                            )}

                            {/* 스택 트레이스 */}
                            {log.stack && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', marginBottom: '4px' }}>Stack Trace</div>
                                <pre style={{
                                  padding: '8px 12px', backgroundColor: '#1F2937', borderRadius: '6px',
                                  fontSize: '10px', color: '#D1D5DB', fontFamily: 'monospace',
                                  overflow: 'auto', maxHeight: '200px', lineHeight: 1.5,
                                  margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                }}>
                                  {log.stack}
                                </pre>
                              </div>
                            )}

                            {/* Details JSON */}
                            {Object.keys(log.details).length > 0 && (
                              <div>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280', marginBottom: '4px' }}>Details</div>
                                <pre style={{
                                  padding: '8px 12px', backgroundColor: '#1F2937', borderRadius: '6px',
                                  fontSize: '11px', color: '#D1D5DB', fontFamily: 'monospace',
                                  overflow: 'auto', maxHeight: '200px', lineHeight: 1.4,
                                  margin: 0,
                                }}>
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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

function StatCard({ label, value, color, alert, suffix }: {
  label: string;
  value: number;
  color: string;
  alert?: boolean;
  suffix?: string;
}) {
  return (
    <div style={{
      border: alert ? '2px solid #DC2626' : '1px solid #E5E7EB',
      borderRadius: '12px', padding: '16px',
      backgroundColor: alert ? '#FEF2F2' : '#fff',
    }}>
      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>
        {value.toLocaleString()}{suffix && <span style={{ fontSize: '14px', fontWeight: 400, color: '#9CA3AF', marginLeft: '2px' }}>{suffix}</span>}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: '#374151', fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
