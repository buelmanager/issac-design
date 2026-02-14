import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SearchInput, Pagination, LoadingSpinner, EmptyState, ConfirmModal, TabNav } from '../ui';
import toast from 'react-hot-toast';
import {
  CreditCard, RefreshCw, Eye, ArrowLeft,
  CheckCircle, Clock, XCircle, RotateCcw,
  Activity, FileText, Search, ChevronDown, ChevronRight, Timer, Download,
  DollarSign, TrendingUp, AlertTriangle, Ban,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

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

interface PaymentStats {
  totalRevenue: number;
  paidCount: number;
  avgOrderValue: number;
  refundRate: number;
  pendingCount: number;
  failedCount: number;
  dailyRevenue: { date: string; amount: number }[];
}

type ViewMode = 'list' | 'detail' | 'logs';

const PAGE_SIZE = 20;

const PAYMENT_STATUS_MAP: Record<string, {
  label: string;
  badgeClass: string;
  icon: typeof CheckCircle;
}> = {
  INIT: { label: '초기화', badgeClass: 'payment-status-badge-init', icon: Clock },
  PENDING: { label: '결제 대기', badgeClass: 'payment-status-badge-pending', icon: Clock },
  PAID: { label: '결제 완료', badgeClass: 'payment-status-badge-paid', icon: CheckCircle },
  FAILED: { label: '결제 실패', badgeClass: 'payment-status-badge-failed', icon: XCircle },
  CANCELED: { label: '취소됨', badgeClass: 'payment-status-badge-canceled', icon: XCircle },
  REFUND_PENDING: { label: '환불 대기', badgeClass: 'payment-status-badge-refund_pending', icon: RotateCcw },
  REFUNDED: { label: '환불 완료', badgeClass: 'payment-status-badge-refunded', icon: RotateCcw },
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

const LOG_LEVEL_MAP: Record<string, string> = {
  INFO: 'payment-log-level-info',
  WARN: 'payment-log-level-warn',
  ERROR: 'payment-log-level-error',
  CRITICAL: 'payment-log-level-critical',
};

const LOG_DATE_RANGE_PRESETS = [
  { label: '1시간', value: 1 },
  { label: '24시간', value: 24 },
  { label: '7일', value: 24 * 7 },
  { label: '30일', value: 24 * 30 },
  { label: '전체', value: 0 },
];

const PAYMENT_DATE_RANGE_PRESETS = [
  { label: '오늘', value: 'today' },
  { label: '7일', value: '7d' },
  { label: '30일', value: '30d' },
  { label: '전체', value: 'all' },
];

const AUTO_REFRESH_OPTIONS = [
  { label: '꺼짐', value: 0 },
  { label: '10초', value: 10 },
  { label: '30초', value: 30 },
  { label: '60초', value: 60 },
];

const LOG_CSV_HEADERS = ['timestamp', 'level', 'action', 'duration_ms', 'request_id', 'payment_id', 'order_id', 'error', 'http_method', 'http_path', 'http_status', 'actor_ip'];

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

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
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

function getDateRangeParams(preset: string): { from?: string; to?: string } {
  const now = new Date();
  if (preset === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString() };
  }
  if (preset === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { from: start.toISOString() };
  }
  if (preset === '30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { from: start.toISOString() };
  }
  return {};
}

function PaymentStatusBadge({ status }: { status: string }) {
  const config = PAYMENT_STATUS_MAP[status] ?? PAYMENT_STATUS_MAP.INIT;
  const Icon = config.icon;
  return (
    <span className={`payment-status-badge ${config.badgeClass}`}>
      <Icon size={12} aria-hidden="true" />
      {config.label}
    </span>
  );
}

function getLogValue(log: SystemLogEntry, key: string): string {
  switch (key) {
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

function escapeCsvField(val: string): string {
  return val.includes(',') || val.includes('"') || val.includes('\n')
    ? `"${val.replace(/"/g, '""')}"`
    : val;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [dateRange, setDateRange] = useState('all');

  const [logFilter, setLogFilter] = useState<{ level: string; view: string }>({ level: 'all', view: 'all' });
  const [logSearch, setLogSearch] = useState('');
  const [logDateRange, setLogDateRange] = useState(0);
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [detailTab, setDetailTab] = useState<'timeline' | 'systemlogs'>('timeline');
  const [detailSystemLogs, setDetailSystemLogs] = useState<SystemLogEntry[]>([]);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: 'cancel' | 'refund';
    paymentId: string;
    loading: boolean;
  }>({ open: false, type: 'cancel', paymentId: '', loading: false });
  const [actionReason, setActionReason] = useState('');

  const authHeaders = useMemo(
    (): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    [accessToken],
  );

  const fetchPaymentStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-stats', { headers: authHeaders });
      const json = await res.json();
      if (json.success) setPaymentStats(json.data as PaymentStats);
    } catch { /* silent */ }
  }, [authHeaders]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const range = getDateRangeParams(dateRange);
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);

      const res = await fetch(`/api/admin/payments?${params.toString()}`, { headers: authHeaders });
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
  }, [page, statusFilter, search, dateRange, authHeaders]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);
  useEffect(() => { if (view === 'list') fetchPaymentStats(); }, [view, fetchPaymentStats]);

  const openDetail = useCallback(async (payment: PaymentRow) => {
    setSelectedPayment(payment);
    setView('detail');
    setDetailTab('timeline');

    try {
      const res = await fetch(`/api/admin/payments?payment_id=${payment.id}`, { headers: authHeaders });
      const json = await res.json();
      if (json.success) {
        setSelectedPayment(json.data.payment as PaymentRow);
        setStatusLogs(json.data.statusLogs as StatusLogRow[]);
      }
    } catch {
      toast.error('결제 상세 조회 실패');
    }
  }, [authHeaders]);

  const fetchDetailSystemLogs = useCallback(async (paymentId: string) => {
    try {
      const params = new URLSearchParams({ payment_id: paymentId, limit: '100' });
      const res = await fetch(`/api/payment/logs?${params.toString()}`, { headers: authHeaders });
      const json = await res.json();
      if (json.success) setDetailSystemLogs(json.data.logs ?? []);
    } catch {
      toast.error('시스템 로그 조회 실패');
    }
  }, [authHeaders]);

  useEffect(() => {
    if (detailTab === 'systemlogs' && selectedPayment) {
      fetchDetailSystemLogs(selectedPayment.id);
    }
  }, [detailTab, selectedPayment, fetchDetailSystemLogs]);

  const openLogs = useCallback(async () => {
    setView('logs');
    await fetchSystemLogs();
    await fetchLogStats();
  }, []);

  const fetchSystemLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (logFilter.level !== 'all') params.set('level', logFilter.level);
      if (logFilter.view !== 'all') params.set('view', logFilter.view);
      if (logSearch) params.set('search', logSearch);
      if (logDateRange > 0) {
        params.set('from', new Date(Date.now() - logDateRange * 60 * 60 * 1000).toISOString());
      }
      params.set('limit', '100');

      const res = await fetch(`/api/payment/logs?${params.toString()}`, { headers: authHeaders });
      const json = await res.json();
      if (json.success) setSystemLogs(json.data.logs ?? []);
    } catch {
      toast.error('시스템 로그 조회 실패');
    }
  }, [logFilter, logSearch, logDateRange, authHeaders]);

  const fetchLogStats = useCallback(async () => {
    try {
      const res = await fetch('/api/payment/logs?view=stats', { headers: authHeaders });
      const json = await res.json();
      if (json.success) setLogStats(json.data);
    } catch { /* silent */ }
  }, [authHeaders]);

  const exportLogs = useCallback((format: 'json' | 'csv') => {
    if (systemLogs.length === 0) { toast.error('내보낼 로그가 없습니다'); return; }
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'json') {
      downloadBlob(JSON.stringify(systemLogs, null, 2), `system-logs-${dateStr}.json`, 'application/json');
    } else {
      const rows = systemLogs.map(log => LOG_CSV_HEADERS.map(h => escapeCsvField(getLogValue(log, h))).join(','));
      downloadBlob([LOG_CSV_HEADERS.join(','), ...rows].join('\n'), `system-logs-${dateStr}.csv`, 'text/csv');
    }
    toast.success(`로그를 ${format.toUpperCase()} 파일로 저장했습니다`);
  }, [systemLogs]);

  const exportPayments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ export: 'csv' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const range = getDateRangeParams(dateRange);
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);

      const res = await fetch(`/api/admin/payments?${params.toString()}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Export failed');
      const csvText = await res.text();
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(csvText, `payments-${dateStr}.csv`, 'text/csv; charset=utf-8');
      toast.success('결제 데이터를 CSV로 내보냈습니다');
    } catch {
      toast.error('내보내기 실패');
    }
  }, [statusFilter, search, dateRange, authHeaders]);

  const handleCancelPayment = useCallback(async () => {
    setConfirmModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/payment/cancel', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: confirmModal.paymentId, reason: actionReason || '관리자 취소' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? '취소 실패');
      toast.success('결제가 취소되었습니다');
      setConfirmModal({ open: false, type: 'cancel', paymentId: '', loading: false });
      setActionReason('');
      if (selectedPayment) openDetail(selectedPayment);
      fetchPayments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '결제 취소 실패');
      setConfirmModal(prev => ({ ...prev, loading: false }));
    }
  }, [confirmModal.paymentId, actionReason, authHeaders, selectedPayment, openDetail, fetchPayments]);

  const handleRefundPayment = useCallback(async () => {
    setConfirmModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch('/api/payment/refund', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: confirmModal.paymentId, reason: actionReason || '관리자 환불' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? '환불 실패');
      toast.success('환불이 요청되었습니다');
      setConfirmModal({ open: false, type: 'cancel', paymentId: '', loading: false });
      setActionReason('');
      if (selectedPayment) openDetail(selectedPayment);
      fetchPayments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '환불 요청 실패');
      setConfirmModal(prev => ({ ...prev, loading: false }));
    }
  }, [confirmModal.paymentId, actionReason, authHeaders, selectedPayment, openDetail, fetchPayments]);

  useEffect(() => {
    if (view === 'logs') fetchSystemLogs();
  }, [logFilter, fetchSystemLogs, view]);

  useEffect(() => {
    if (autoRefreshRef.current) { clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; }
    if (autoRefreshInterval > 0 && view === 'logs') {
      autoRefreshRef.current = setInterval(() => { fetchSystemLogs(); fetchLogStats(); }, autoRefreshInterval * 1000);
    }
    return () => { if (autoRefreshRef.current) { clearInterval(autoRefreshRef.current); autoRefreshRef.current = null; } };
  }, [autoRefreshInterval, view, fetchSystemLogs, fetchLogStats]);

  const detailTabs = useMemo(() => [
    { key: 'timeline', label: '상태 타임라인' },
    { key: 'systemlogs', label: '시스템 로그' },
  ], []);

  if (view === 'list') {
    return (
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">결제 관리</h1>
            <p className="admin-text-muted">전체 {totalCount}건의 결제 내역</p>
          </div>
          <div className="admin-page-header-actions">
            <button className="payment-export-btn" onClick={exportPayments} aria-label="결제 데이터 CSV 내보내기">
              <Download size={16} aria-hidden="true" /> 내보내기
            </button>
            <button className="admin-btn admin-btn-secondary" onClick={openLogs} aria-label="결제 시스템 로그 보기">
              <Activity size={16} aria-hidden="true" /> 시스템 로그
            </button>
            <button className="admin-btn admin-btn-primary" onClick={fetchPayments} aria-label="결제 목록 새로고침">
              <RefreshCw size={16} aria-hidden="true" /> 새로고침
            </button>
          </div>
        </div>

        {paymentStats && (
          <>
            <div className="payment-summary-stats">
              <div className="admin-stat-card">
                <div className="admin-stat-icon admin-stat-icon-green"><DollarSign size={24} /></div>
                <div className="admin-stat-number">{formatAmount(paymentStats.totalRevenue)}</div>
                <div className="admin-stat-label">총 매출</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon admin-stat-icon-blue"><CreditCard size={24} /></div>
                <div className="admin-stat-number">{paymentStats.paidCount}건</div>
                <div className="admin-stat-label">결제 건수</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon admin-stat-icon-purple"><TrendingUp size={24} /></div>
                <div className="admin-stat-number">{formatAmount(paymentStats.avgOrderValue)}</div>
                <div className="admin-stat-label">평균 주문액</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon admin-stat-icon-amber"><RotateCcw size={24} /></div>
                <div className="admin-stat-number">{paymentStats.refundRate}%</div>
                <div className="admin-stat-label">환불율</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon admin-stat-icon-amber"><AlertTriangle size={24} /></div>
                <div className="admin-stat-number">{paymentStats.pendingCount}건</div>
                <div className="admin-stat-label">대기 건수</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-icon admin-stat-icon-blue"><Ban size={24} /></div>
                <div className="admin-stat-number">{paymentStats.failedCount}건</div>
                <div className="admin-stat-label">실패 건수</div>
              </div>
            </div>

            {paymentStats.dailyRevenue.length > 0 && (
              <div className="admin-chart-card">
                <div className="admin-chart-header">
                  <h3 className="admin-card-title">최근 7일 매출 추이</h3>
                </div>
                <div className="admin-chart-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={paymentStats.dailyRevenue} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="paymentRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--admin-accent, #6366f1)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="var(--admin-accent, #6366f1)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                      <YAxis tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip formatter={(v) => formatAmount(Number(v ?? 0))} labelFormatter={(label) => formatDateShort(String(label))} />
                      <Area type="monotone" dataKey="amount" stroke="var(--admin-accent, #6366f1)" strokeWidth={2} fill="url(#paymentRevenueGrad)" dot={false} activeDot={{ r: 5, stroke: 'var(--admin-accent, #6366f1)', strokeWidth: 2, fill: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </>
        )}

        <div className="admin-toolbar">
          <div className="payment-filter-group">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`payment-filter-btn ${statusFilter === opt.value ? 'payment-filter-btn-active' : ''}`}
                onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="payment-toolbar-sep" />
          <div className="payment-date-range">
            {PAYMENT_DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                className={`payment-date-range-btn ${dateRange === preset.value ? 'payment-date-range-btn-active' : ''}`}
                onClick={() => { setDateRange(preset.value); setPage(1); }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="payment-toolbar-sep" />
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="고객명, 주문번호, PG 결제 ID, 멱등키 검색…"
          />
        </div>

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
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="admin-table-th">주문번호</th>
                    <th className="admin-table-th">고객</th>
                    <th className="admin-table-th">금액</th>
                    <th className="admin-table-th">결제 상태</th>
                    <th className="admin-table-th">PG</th>
                    <th className="admin-table-th">결제 수단</th>
                    <th className="admin-table-th">생성일</th>
                    <th className="admin-table-th">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="admin-table-row admin-table-row-clickable"
                      role="row"
                      tabIndex={0}
                      aria-label={`결제 ${p.orders?.order_number ?? ''} - ${formatAmount(p.amount, p.currency)}`}
                      onClick={() => openDetail(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(p); } }}
                    >
                      <td className="admin-table-td">
                        <span className="payment-code">{p.orders?.order_number ?? '-'}</span>
                      </td>
                      <td className="admin-table-td">
                        <div>{p.orders?.customer_name ?? '-'}</div>
                        <div className="admin-text-muted admin-table-td-sm">{p.orders?.business_name ?? ''}</div>
                      </td>
                      <td className="admin-table-td admin-table-td-number">
                        {formatAmount(p.amount, p.currency)}
                      </td>
                      <td className="admin-table-td"><PaymentStatusBadge status={p.status} /></td>
                      <td className="admin-table-td admin-text-muted admin-table-td-sm">{p.pg_provider ?? '-'}</td>
                      <td className="admin-table-td admin-table-td-sm">{p.method ?? '-'}</td>
                      <td className="admin-table-td admin-text-muted admin-table-td-sm">{getRelativeTime(p.created_at)}</td>
                      <td className="admin-table-td">
                        <button
                          className="admin-btn admin-btn-ghost admin-btn-sm"
                          onClick={(e) => { e.stopPropagation(); openDetail(p); }}
                          aria-label={`${p.orders?.order_number ?? '결제'} 상세 보기`}
                        >
                          <Eye size={14} aria-hidden="true" /> 상세
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(totalCount / PAGE_SIZE)}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    );
  }

  if (view === 'detail' && selectedPayment) {
    const p = selectedPayment;
    const order = p.orders;

    return (
      <div className="admin-page">
        <button className="admin-btn admin-btn-ghost" onClick={() => setView('list')} aria-label="결제 목록으로 돌아가기">
          <ArrowLeft size={16} aria-hidden="true" /> 목록으로
        </button>

        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">결제 상세 - {order?.order_number ?? ''}</h1>
            <p className="admin-text-muted">Payment ID: <code className="payment-code">{p.id}</code></p>
          </div>
          <div className="admin-page-header-actions">
            <PaymentStatusBadge status={p.status} />
            {p.status === 'PENDING' && (
              <button
                className="admin-btn admin-btn-danger admin-btn-sm"
                onClick={() => { setConfirmModal({ open: true, type: 'cancel', paymentId: p.id, loading: false }); setActionReason(''); }}
              >
                <XCircle size={14} aria-hidden="true" /> 결제 취소
              </button>
            )}
            {p.status === 'PAID' && (
              <button
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={() => { setConfirmModal({ open: true, type: 'refund', paymentId: p.id, loading: false }); setActionReason(''); }}
              >
                <RotateCcw size={14} aria-hidden="true" /> 환불 요청
              </button>
            )}
          </div>
        </div>

        <div className="payment-info-grid">
          <div className="payment-detail-col">
            <div className="admin-card">
              <h3 className="admin-card-title"><CreditCard size={18} /> 결제 정보</h3>
              <div className="admin-card-body">
                <div className="admin-detail-row"><span className="admin-detail-label">결제 금액</span><span className="admin-detail-value admin-detail-value-highlight">{formatAmount(p.amount, p.currency)}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">결제 수단</span><span className="admin-detail-value">{p.method ?? '-'}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">PG사</span><span className="admin-detail-value">{p.pg_provider ?? '-'}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">PG 결제 ID</span><span className="admin-detail-value"><code className="payment-code">{p.pg_payment_id ?? '-'}</code></span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">멱등키</span><span className="admin-detail-value"><code className="payment-code">{p.idempotency_key}</code></span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">생성일시</span><span className="admin-detail-value">{formatDateTime(p.created_at)}</span></div>
                {p.paid_at && <div className="admin-detail-row"><span className="admin-detail-label">결제일시</span><span className="admin-detail-value">{formatDateTime(p.paid_at)}</span></div>}
                {p.canceled_at && <div className="admin-detail-row"><span className="admin-detail-label">취소일시</span><span className="admin-detail-value">{formatDateTime(p.canceled_at)}</span></div>}
                {p.refunded_at && <div className="admin-detail-row"><span className="admin-detail-label">환불일시</span><span className="admin-detail-value">{formatDateTime(p.refunded_at)}</span></div>}
                {p.failed_reason && <div className="admin-detail-row"><span className="admin-detail-label">실패 사유</span><span className="admin-detail-value admin-detail-value-error">{p.failed_reason}</span></div>}
              </div>
            </div>

            {order && (
              <div className="admin-card">
                <h3 className="admin-card-title"><FileText size={18} /> 주문 정보</h3>
                <div className="admin-card-body">
                  <div className="admin-detail-row"><span className="admin-detail-label">주문번호</span><span className="admin-detail-value"><code className="payment-code">{order.order_number}</code></span></div>
                  <div className="admin-detail-row"><span className="admin-detail-label">고객명</span><span className="admin-detail-value">{order.customer_name}</span></div>
                  <div className="admin-detail-row"><span className="admin-detail-label">연락처</span><span className="admin-detail-value">{order.customer_phone}</span></div>
                  <div className="admin-detail-row"><span className="admin-detail-label">이메일</span><span className="admin-detail-value">{order.customer_email ?? '-'}</span></div>
                  <div className="admin-detail-row"><span className="admin-detail-label">업체명</span><span className="admin-detail-value">{order.business_name ?? '-'}</span></div>
                  <div className="admin-detail-row"><span className="admin-detail-label">주문 상태</span><span className="admin-detail-value">{ORDER_STATUS_LABELS[order.status] ?? order.status}</span></div>
                  <div className="admin-detail-row"><span className="admin-detail-label">주문 금액</span><span className="admin-detail-value">{formatAmount(order.total_amount)}</span></div>
                </div>
              </div>
            )}

            {p.pg_response && Object.keys(p.pg_response).length > 0 && (
              <div className="admin-card">
                <h3 className="admin-card-title">PG 원본 응답</h3>
                <pre className="payment-pg-response">{JSON.stringify(p.pg_response, null, 2)}</pre>
              </div>
            )}
          </div>

          <div>
            <TabNav tabs={detailTabs} activeTab={detailTab} onChange={(key) => setDetailTab(key as 'timeline' | 'systemlogs')} />

            {detailTab === 'timeline' ? (
              <div className="admin-card">
                <h3 className="admin-card-title"><Activity size={18} /> 상태 변경 타임라인</h3>
                {statusLogs.length === 0 ? (
                  <p className="admin-text-muted payment-empty-center">상태 변경 기록이 없습니다</p>
                ) : (
                  <div className="payment-timeline">
                    <div className="payment-timeline-line" />
                    {statusLogs.map((log) => (
                      <div key={log.id} className="payment-timeline-item">
                        <div className={`payment-timeline-dot payment-timeline-dot-${log.to_status.toLowerCase()}`} />
                        <div className="payment-timeline-content">
                          <div className="payment-timeline-statuses">
                            <PaymentStatusBadge status={log.from_status} />
                            <span className="payment-timeline-arrow">→</span>
                            <PaymentStatusBadge status={log.to_status} />
                          </div>
                          <div className="payment-timeline-meta">
                            <span>{formatDateTime(log.created_at)}</span>
                            <span>|</span>
                            <span className="payment-timeline-actor">{log.actor}</span>
                          </div>
                          {log.reason && <div className="payment-timeline-reason">{log.reason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="admin-card">
                <h3 className="admin-card-title"><FileText size={18} /> 이 결제의 시스템 로그</h3>
                {detailSystemLogs.length === 0 ? (
                  <p className="admin-text-muted payment-empty-center">시스템 로그가 없습니다</p>
                ) : (
                  <div className="payment-log-detail-list">
                    {detailSystemLogs.map((log, i) => {
                      const levelClass = LOG_LEVEL_MAP[log.level] ?? LOG_LEVEL_MAP.INFO;
                      const entryClass = log.level === 'CRITICAL' ? 'payment-log-entry-critical' : log.level === 'ERROR' ? 'payment-log-entry-error' : '';
                      return (
                        <div key={`${log.timestamp}-${log.action}-${i}`} className={`payment-log-entry ${entryClass}`}>
                          <div className="payment-log-entry-header">
                            <span className={`payment-log-level ${levelClass}`}>{log.level}</span>
                            <span className="payment-log-entry-action">{log.action}</span>
                            {log.duration_ms != null && <span className="payment-log-entry-duration">{log.duration_ms}ms</span>}
                            <span className="payment-log-entry-time">{getRelativeTime(log.timestamp)}</span>
                          </div>
                          {log.error && <div className="payment-log-entry-error-text">{log.error}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <ConfirmModal
          isOpen={confirmModal.open}
          title={confirmModal.type === 'cancel' ? '결제 취소' : '환불 요청'}
          message={confirmModal.type === 'cancel' ? '이 결제를 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.' : '이 결제에 대해 환불을 요청하시겠습니까?'}
          confirmLabel={confirmModal.type === 'cancel' ? '결제 취소' : '환불 요청'}
          cancelLabel="닫기"
          variant="danger"
          loading={confirmModal.loading}
          onConfirm={confirmModal.type === 'cancel' ? handleCancelPayment : handleRefundPayment}
          onCancel={() => { setConfirmModal({ open: false, type: 'cancel', paymentId: '', loading: false }); setActionReason(''); }}
        />
        {confirmModal.open && (
          <input
            className="payment-confirm-input sr-only"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder="사유를 입력하세요 (선택)"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}
      </div>
    );
  }

  if (view === 'logs') {
    return (
      <div className="admin-page">
        <button className="admin-btn admin-btn-ghost" onClick={() => { setView('list'); setAutoRefreshInterval(0); }} aria-label="결제 관리 목록으로 돌아가기">
          <ArrowLeft size={16} aria-hidden="true" /> 결제 관리로
        </button>

        <div className="admin-page-header">
          <h1 className="admin-page-title">결제 시스템 로그</h1>
          <div className="payment-auto-refresh">
            <span className="payment-auto-refresh-label"><Timer size={14} aria-hidden="true" /> 자동 새로고침:</span>
            {AUTO_REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`payment-auto-refresh-btn ${autoRefreshInterval === opt.value ? 'payment-auto-refresh-btn-active' : ''}`}
                onClick={() => setAutoRefreshInterval(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {logStats && (
          <div className="payment-summary-stats">
            <LogStatCard label="전체 로그" value={logStats.total} colorClass="payment-stat-value-dark" />
            <LogStatCard label="INFO" value={logStats.by_level.INFO ?? 0} colorClass="payment-stat-value-blue" />
            <LogStatCard label="WARN" value={logStats.by_level.WARN ?? 0} colorClass="payment-stat-value-amber" />
            <LogStatCard label="ERROR" value={logStats.by_level.ERROR ?? 0} colorClass="payment-stat-value-red" />
            <LogStatCard label="최근 1시간 오류" value={logStats.recent_errors} colorClass={logStats.recent_errors > 0 ? 'payment-stat-value-red' : 'payment-stat-value-green'} alert={logStats.recent_errors > 0} />
            {logStats.avg_api_duration_ms != null && <LogStatCard label="평균 API 응답" value={logStats.avg_api_duration_ms} colorClass="payment-stat-value-purple" suffix="ms" />}
            {logStats.pg_call_count != null && <LogStatCard label="PG 호출 수" value={logStats.pg_call_count} colorClass="payment-stat-value-cyan" />}
          </div>
        )}

        <div className="admin-toolbar">
          <div className="payment-filter-group">
            {['all', 'INFO', 'WARN', 'ERROR', 'CRITICAL'].map((lvl) => (
              <button
                key={lvl}
                className={`payment-filter-btn payment-filter-btn-sm ${logFilter.level === lvl ? 'payment-filter-btn-active' : ''}`}
                onClick={() => setLogFilter((prev) => ({ ...prev, level: lvl }))}
              >
                {lvl === 'all' ? '전체' : lvl}
              </button>
            ))}
          </div>
          <div className="payment-toolbar-sep" />
          <div className="payment-date-range">
            {LOG_DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                className={`payment-date-range-btn ${logDateRange === preset.value ? 'payment-date-range-btn-active' : ''}`}
                onClick={() => setLogDateRange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="payment-toolbar-sep" />
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { fetchSystemLogs(); fetchLogStats(); }} aria-label="시스템 로그 새로고침">
            <RefreshCw size={12} aria-hidden="true" /> 새로고침
          </button>
          <div className="payment-toolbar-sep" />
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => exportLogs('json')} aria-label="로그를 JSON 파일로 내보내기">
            <Download size={12} aria-hidden="true" /> JSON
          </button>
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => exportLogs('csv')} aria-label="로그를 CSV 파일로 내보내기">
            <Download size={12} aria-hidden="true" /> CSV
          </button>
        </div>

        <div className="payment-search-wrapper payment-search-wrapper-mb">
          <Search size={14} className="payment-search-icon" aria-hidden="true" />
          <input
            type="text"
            className="payment-search-input"
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fetchSystemLogs(); }}
            placeholder="action, error, payment_id, request_id…"
            aria-label="로그 검색"
          />
        </div>

        <div className="payment-log-table-wrapper">
          <table className="payment-log-table">
            <thead>
              <tr>
                <th className="payment-log-th-toggle" />
                <th className="payment-log-th-time">시간</th>
                <th className="payment-log-th-level">레벨</th>
                <th>액션</th>
                <th className="payment-log-th-duration">소요시간</th>
                <th className="payment-log-th-request">Request</th>
                <th>요약</th>
              </tr>
            </thead>
            <tbody>
              {systemLogs.map((log, i) => {
                const levelClass = LOG_LEVEL_MAP[log.level] ?? LOG_LEVEL_MAP.INFO;
                const isExpanded = expandedLogIndex === i;
                const rowClass = log.level === 'CRITICAL' ? 'payment-log-table-row-critical' : log.level === 'ERROR' ? 'payment-log-table-row-error' : '';
                return (
                  <LogTableRow
                    key={`${log.timestamp}-${log.action}-${i}`}
                    log={log}
                    index={i}
                    levelClass={levelClass}
                    rowClass={rowClass}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedLogIndex(isExpanded ? null : i)}
                  />
                );
              })}
            </tbody>
          </table>
          {systemLogs.length === 0 && (
            <div className="payment-log-table-empty">로그가 없습니다</div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

function LogStatCard({ label, value, colorClass, alert, suffix }: {
  label: string;
  value: number;
  colorClass: string;
  alert?: boolean;
  suffix?: string;
}) {
  return (
    <div className={`payment-stat-card ${alert ? 'payment-stat-card-alert' : ''}`}>
      <div className="payment-stat-card-label">{label}</div>
      <div className={`payment-stat-card-value ${colorClass}`}>
        {value.toLocaleString()}
        {suffix && <span className="payment-stat-card-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

function LogTableRow({ log, index, levelClass, rowClass, isExpanded, onToggle }: {
  log: SystemLogEntry;
  index: number;
  levelClass: string;
  rowClass: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasExpandedContent = log.error || log.stack || Object.keys(log.details).length > 0 || log.request_id || log.payment_id;
  return (
    <>
      <tr
        className={`${rowClass}${isExpanded ? ' payment-log-table-row-no-border' : ''}`}
        role="row"
        tabIndex={0}
        aria-label={`${log.level} ${log.action}`}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
      >
        <td className="payment-log-table-cell-center">
          {isExpanded
            ? <ChevronDown size={14} aria-hidden="true" className="admin-text-muted" />
            : <ChevronRight size={14} aria-hidden="true" className="admin-text-muted" />
          }
        </td>
        <td className="payment-log-table-cell-mono">{formatDateTime(log.timestamp)}</td>
        <td><span className={`payment-log-level ${levelClass}`}>{log.level}</span></td>
        <td className="payment-log-table-action">{log.action}</td>
        <td className="payment-log-table-cell-tabular">
          {log.duration_ms != null ? `${log.duration_ms}ms` : '-'}
        </td>
        <td className="payment-log-table-cell-mono">
          {log.request_id ? log.request_id.slice(0, 8) + '…' : '-'}
        </td>
        <td className="payment-log-table-cell-truncate">
          {log.error ? (
            <span className="payment-log-error-text">{log.error}</span>
          ) : (
            <span className="admin-text-muted">{JSON.stringify(log.details).slice(0, 80)}</span>
          )}
        </td>
      </tr>
      {isExpanded && hasExpandedContent && (
        <tr key={`expanded-${index}`}>
          <td colSpan={7} className="payment-log-expanded-cell">
            <div className="payment-log-expanded">
              <div className={`payment-log-meta-grid${(log.error || Object.keys(log.details).length > 0) ? ' payment-log-meta-grid-mb' : ''}`}>
                {log.request_id && <LogMetaItem label="Request ID" value={log.request_id} />}
                {log.payment_id && <LogMetaItem label="Payment ID" value={log.payment_id} />}
                {log.order_id && <LogMetaItem label="Order ID" value={log.order_id} />}
                {log.http_method && <LogMetaItem label="HTTP" value={`${log.http_method} ${log.http_path ?? ''} → ${log.http_status ?? ''}`} />}
                {log.actor_ip && <LogMetaItem label="IP" value={log.actor_ip} />}
                {log.duration_ms != null && <LogMetaItem label="소요시간" value={`${log.duration_ms}ms`} />}
              </div>
              {log.error && (
                <div className="payment-log-section-mb">
                  <div className="payment-log-section-label-error">Error</div>
                  <div className="payment-log-error-block">{log.error}</div>
                </div>
              )}
              {log.stack && (
                <div className="payment-log-section-mb">
                  <div className="payment-log-section-label">Stack Trace</div>
                  <pre className="payment-stack-trace">{log.stack}</pre>
                </div>
              )}
              {Object.keys(log.details).length > 0 && (
                <div>
                  <div className="payment-log-section-label">Details</div>
                  <pre className="payment-detail-json">{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LogMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="payment-log-meta-item-label">{label}</div>
      <div className="payment-log-meta-item-value">{value}</div>
    </div>
  );
}
