import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../ui';
import {
  DollarSign,
  ShoppingCart,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Clock,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface KpiStats {
  totalRevenue: number;
  totalRevenueChange: number;
  todayOrders: number;
  todayOrdersChange: number;
  newMembers: number;
  newMembersChange: number;
  pendingQuotes: number;
}

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

interface DashboardData {
  kpiStats: KpiStats;
  revenueTrend: RevenueTrendItem[];
  orderStatusDistribution: OrderStatusItem[];
  recentOrders: RecentOrder[];
  pendingActions: PendingActions;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: '#f59e0b',
  paid: '#3b82f6',
  processing: '#8b5cf6',
  shipped: '#06b6d4',
  delivered: '#22c55e',
  canceled: '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  pending_payment: '결제대기',
  paid: '결제완료',
  processing: '처리중',
  shipped: '배송중',
  delivered: '배송완료',
  canceled: '취소',
};

function formatCurrency(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`;
}

function formatCurrencyShort(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만`;
  return value.toLocaleString('ko-KR');
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getOrderBadgeVariant(status: string): string {
  const map: Record<string, string> = {
    pending_payment: 'warning',
    paid: 'info',
    processing: 'info',
    shipped: 'info',
    delivered: 'success',
    canceled: 'danger',
  };
  return map[status] ?? 'default';
}

function formatDateKorean(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

interface TooltipPayloadItem {
  value: number;
  dataKey: string;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function RevenueTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="admin-chart-tooltip">
      <p className="admin-chart-tooltip-label">{formatDateKorean(label)}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="admin-chart-tooltip-value" style={{ color: item.color }}>
          {item.dataKey === 'revenue' ? `매출: ${formatCurrency(item.value)}` : `주문: ${item.value}건`}
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodDays, setPeriodDays] = useState<7 | 30>(7);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/dashboard-stats', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!response.ok) throw new Error(`API 오류: ${response.status}`);
      const result = await response.json() as { success: boolean; data: DashboardData; error?: { message: string } };
      if (!result.success) throw new Error(result.error?.message ?? '데이터 로드 실패');
      setStats(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const filteredRevenueTrend = useMemo(() => {
    if (!stats) return [];
    return periodDays === 7 ? stats.revenueTrend.slice(-7) : stats.revenueTrend;
  }, [stats, periodDays]);

  if (loading) return <LoadingSpinner size="lg" />;

  if (error) {
    return (
      <div className="admin-page">
        <h1 className="admin-page-title">대시보드</h1>
        <div className="admin-card" style={{ padding: 40, textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
          <p style={{ color: '#ef4444', fontSize: 16, marginBottom: 16 }}>{error}</p>
          <button className="admin-btn admin-btn-primary" onClick={fetchDashboard}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { kpiStats, orderStatusDistribution, recentOrders, pendingActions } = stats;

  const kpiCards = [
    {
      label: '총 매출',
      value: formatCurrency(kpiStats.totalRevenue),
      change: kpiStats.totalRevenueChange,
      icon: <DollarSign size={24} />,
      color: 'blue' as const,
      link: '/payments',
    },
    {
      label: '오늘 주문',
      value: `${kpiStats.todayOrders}건`,
      change: kpiStats.todayOrdersChange,
      icon: <ShoppingCart size={24} />,
      color: 'amber' as const,
      link: '/payments',
    },
    {
      label: '신규 회원',
      value: `${kpiStats.newMembers}명`,
      change: kpiStats.newMembersChange,
      icon: <Users size={24} />,
      color: 'green' as const,
      link: '/members',
    },
    {
      label: '대기 견적',
      value: `${kpiStats.pendingQuotes}건`,
      change: 0,
      icon: <FileText size={24} />,
      color: 'purple' as const,
      link: '/quotes',
    },
  ];

  const totalOrders = orderStatusDistribution.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">대시보드</h1>

      <div className="admin-dashboard-stats">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="admin-stat-card admin-stat-card-clickable"
            onClick={() => navigate(card.link)}
          >
            <div className={`admin-stat-icon admin-stat-icon-${card.color}`}>{card.icon}</div>
            <div className="admin-stat-number">{card.value}</div>
            <div className="admin-stat-footer">
              <span className="admin-stat-label">{card.label}</span>
              {card.change !== 0 && (
                <span className={`admin-stat-trend ${card.change > 0 ? 'admin-stat-trend-up' : 'admin-stat-trend-down'}`}>
                  {card.change > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(card.change)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <h2 className="admin-card-title">매출 추이</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="admin-chart-toggle">
                <button
                  className={`admin-chart-toggle-btn ${periodDays === 7 ? 'active' : ''}`}
                  onClick={() => setPeriodDays(7)}
                >
                  7일
                </button>
                <button
                  className={`admin-chart-toggle-btn ${periodDays === 30 ? 'active' : ''}`}
                  onClick={() => setPeriodDays(30)}
                >
                  30일
                </button>
              </div>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => navigate('/payments')}>
                상세 <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="admin-chart-body">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={filteredRevenueTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateShort}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `₩${formatCurrencyShort(v)}`}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip content={<RevenueTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-chart-card">
          <div className="admin-chart-header">
            <h2 className="admin-card-title">주문 현황</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="admin-chart-total">총 {totalOrders}건</span>
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => navigate('/payments')}>
                상세 <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className="admin-chart-body admin-chart-body-pie">
            {orderStatusDistribution.length === 0 ? (
              <p className="admin-empty-text">주문 데이터가 없습니다</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={orderStatusDistribution}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {orderStatusDistribution.map((entry) => (
                        <Cell
                          key={entry.status}
                          fill={STATUS_COLORS[entry.status] ?? '#d1d5db'}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="admin-chart-legend">
                  {orderStatusDistribution.map((entry) => (
                    <div key={entry.status} className="admin-chart-legend-item">
                      <span
                        className="admin-chart-legend-dot"
                        style={{ background: STATUS_COLORS[entry.status] ?? '#d1d5db' }}
                      />
                      <span className="admin-chart-legend-label">
                        {STATUS_LABELS[entry.status] ?? entry.status}
                      </span>
                      <span className="admin-chart-legend-count">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">최근 주문</h2>
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => navigate('/payments')}>
              전체보기 <ChevronRight size={14} />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <p className="admin-empty-text">주문이 없습니다</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>주문번호</th>
                  <th>고객명</th>
                  <th>금액</th>
                  <th>상태</th>
                  <th>날짜</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr
                    key={order.order_number}
                    className="admin-table-row-clickable"
                    onClick={() => navigate('/payments')}
                  >
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{order.order_number}</td>
                    <td>{order.customer_name}</td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${getOrderBadgeVariant(order.status)}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td>{formatDateKorean(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">빠른 조치</h2>
          </div>
          <div className="admin-pending-list">
            <div className="admin-pending-item" onClick={() => navigate('/quotes')}>
              <div className="admin-pending-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <FileText size={20} />
              </div>
              <div className="admin-pending-info">
                <span className="admin-pending-label">대기 견적</span>
                <span className="admin-pending-count">{pendingActions.pendingQuotes}건</span>
              </div>
              <ChevronRight size={16} className="admin-pending-arrow" />
            </div>
            <div className="admin-pending-item" onClick={() => navigate('/inquiries')}>
              <div className="admin-pending-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                <MessageSquare size={20} />
              </div>
              <div className="admin-pending-info">
                <span className="admin-pending-label">새 문의</span>
                <span className="admin-pending-count">{pendingActions.newInquiries}건</span>
              </div>
              <ChevronRight size={16} className="admin-pending-arrow" />
            </div>
            <div className="admin-pending-item" onClick={() => navigate('/payments')}>
              <div className="admin-pending-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                <Clock size={20} />
              </div>
              <div className="admin-pending-info">
                <span className="admin-pending-label">처리 필요 주문</span>
                <span className="admin-pending-count">{pendingActions.processingOrders}건</span>
              </div>
              <ChevronRight size={16} className="admin-pending-arrow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
