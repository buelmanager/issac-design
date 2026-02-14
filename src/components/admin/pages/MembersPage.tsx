import { useState, useEffect, useCallback } from 'react';
import { DataTable, SearchInput, Pagination, LoadingSpinner, EmptyState, TabNav, StatusBadge, ConfirmModal } from '../ui';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Users, Mail, Phone, Calendar, ShoppingBag, CreditCard,
  Download, FileText, UserCheck, AlertTriangle, ArrowLeft,
} from 'lucide-react';

// ─── 타입 ────────────────────────────────────────
interface MemberListItem {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  provider: string;
  status: string;
  admin_notes: string;
  created_at: string;
  updated_at: string;
  order_count: number;
  total_spent: number;
}

interface OrderItem {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: unknown;
  payments: Array<{ id: string; status: string; amount: number; paid_at: string | null }>;
}

interface MemberDetail {
  member: MemberListItem;
  orders: OrderItem[];
  stats: { order_count: number; total_spent: number };
}

interface MemberStats {
  total: number;
  active: number;
  suspended: number;
  withdrawn: number;
  total_revenue: number;
}

type ViewMode = 'list' | 'detail';

// ─── 상수 ────────────────────────────────────────
const PAGE_SIZE = 20;

const PROVIDER_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'email', label: '이메일' },
  { value: 'google', label: '구글' },
  { value: 'kakao', label: '카카오' },
];

const PROVIDER_LABELS: Record<string, string> = {
  email: '이메일',
  google: '구글',
  kakao: '카카오',
};

const STATUS_LABELS: Record<string, string> = {
  active: '활성',
  suspended: '정지',
  withdrawn: '탈퇴',
};

const STATUS_VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  active: 'success',
  suspended: 'danger',
  withdrawn: 'warning',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '결제 대기',
  paid: '결제 완료',
  processing: '처리중',
  shipped: '배송중',
  delivered: '배송 완료',
  canceled: '취소',
};

const STATUS_OPTIONS = [
  { value: 'active', label: '활성' },
  { value: 'suspended', label: '정지' },
  { value: 'withdrawn', label: '탈퇴' },
];

// ─── 유틸 ────────────────────────────────────────
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// ─── StatCard 헬퍼 ────────────────────────────────
function StatCard({ icon, label, value, colorClass, alert, suffix, isCurrency }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
  alert?: boolean;
  suffix?: string;
  isCurrency?: boolean;
}) {
  const displayValue = isCurrency ? value.toLocaleString('ko-KR') : value.toLocaleString();
  return (
    <div className={`member-stat-card ${alert ? 'member-stat-card-alert' : ''}`}>
      <div className="member-stat-card-header">{icon}{label}</div>
      <div className={`member-stat-card-value ${colorClass}`}>
        {displayValue}
        {suffix && <span className="member-stat-card-suffix">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── 컴포넌트 ────────────────────────────────────
export default function MembersPage() {
  const { accessToken } = useAuth();

  const [view, setView] = useState<ViewMode>('list');

  const [stats, setStats] = useState<MemberStats | null>(null);

  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortColumn, setSortColumn] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [selectedMember, setSelectedMember] = useState<MemberListItem | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [statusChangeTarget, setStatusChangeTarget] = useState('');
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const [editNotes, setEditNotes] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const [csvExporting, setCsvExporting] = useState(false);

  // ─── API 호출 ──────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/members?view=stats', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch {
      // 통계 실패는 무시
    }
  }, [accessToken]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (providerFilter !== 'all') params.set('provider', providerFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('sort', sortColumn);
      params.set('sort_dir', sortDir);

      const res = await fetch(`/api/admin/members?${params.toString()}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      setMembers(json.data.members);
      setTotal(json.data.totalCount);
    } catch {
      toast.error('회원 목록을 불러올 수 없습니다');
    }
    setLoading(false);
  }, [search, providerFilter, statusFilter, dateFrom, dateTo, page, sortColumn, sortDir, accessToken]);

  const openDetail = useCallback(async (member: MemberListItem) => {
    setSelectedMember(member);
    setEditNotes(member.admin_notes ?? '');
    setStatusChangeTarget(member.status);
    setView('detail');
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/members?member_id=${member.id}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      setMemberDetail(json.data);
      setEditNotes(json.data.member.admin_notes ?? '');
      setStatusChangeTarget(json.data.member.status);
    } catch {
      toast.error('회원 상세 정보를 불러올 수 없습니다');
    }
    setDetailLoading(false);
  }, [accessToken]);

  const closeDetail = useCallback(() => {
    setView('list');
    setSelectedMember(null);
    setMemberDetail(null);
    setShowStatusConfirm(false);
  }, []);

  const updateMember = useCallback(async (memberId: string, updates: { status?: string; admin_notes?: string }) => {
    const res = await fetch('/api/admin/members', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ member_id: memberId, ...updates }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message || 'Failed');
    return json.data;
  }, [accessToken]);

  const handleStatusChange = useCallback(async () => {
    if (!selectedMember || statusChangeTarget === selectedMember.status) return;
    setStatusUpdating(true);
    try {
      await updateMember(selectedMember.id, { status: statusChangeTarget });
      toast.success(`회원 상태가 "${STATUS_LABELS[statusChangeTarget]}"(으)로 변경되었습니다`);
      setSelectedMember({ ...selectedMember, status: statusChangeTarget });
      setShowStatusConfirm(false);
      fetchMembers();
      fetchStats();
    } catch {
      toast.error('상태 변경에 실패했습니다');
    }
    setStatusUpdating(false);
  }, [selectedMember, statusChangeTarget, updateMember, fetchMembers, fetchStats]);

  const handleNoteSave = useCallback(async () => {
    if (!selectedMember) return;
    setNoteSaving(true);
    try {
      await updateMember(selectedMember.id, { admin_notes: editNotes });
      toast.success('메모가 저장되었습니다');
      setSelectedMember({ ...selectedMember, admin_notes: editNotes });
    } catch {
      toast.error('메모 저장에 실패했습니다');
    }
    setNoteSaving(false);
  }, [selectedMember, editNotes, updateMember]);

  const handleCsvExport = useCallback(async () => {
    setCsvExporting(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('page_size', '100');
      if (search) params.set('search', search);
      if (providerFilter !== 'all') params.set('provider', providerFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      params.set('sort', sortColumn);
      params.set('sort_dir', sortDir);

      const res = await fetch(`/api/admin/members?${params.toString()}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (!json.success) throw new Error('Failed');

      const rows = json.data.members as MemberListItem[];
      const header = ['이메일', '이름', '연락처', '가입방법', '상태', '주문수', '총구매액', '가입일'];
      const csvRows = [
        header.join(','),
        ...rows.map((m) =>
          [
            `"${m.email}"`,
            `"${m.display_name ?? ''}"`,
            `"${m.phone ?? ''}"`,
            PROVIDER_LABELS[m.provider] ?? m.provider,
            STATUS_LABELS[m.status] ?? m.status,
            m.order_count,
            m.total_spent,
            formatDate(m.created_at),
          ].join(',')
        ),
      ];

      const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `members_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV 다운로드 완료');
    } catch {
      toast.error('CSV 내보내기에 실패했습니다');
    }
    setCsvExporting(false);
  }, [search, providerFilter, statusFilter, dateFrom, dateTo, sortColumn, sortDir, accessToken]);

  const handleSort = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortColumn(column);
    setSortDir(direction);
  }, []);

  // ─── 효과 ──────────────────────────────────────
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    setPage(1);
  }, [search, providerFilter, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statusTabs = [
    { key: 'all', label: '전체', count: stats?.total },
    { key: 'active', label: '활성', count: stats?.active },
    { key: 'suspended', label: '정지', count: stats?.suspended },
    { key: 'withdrawn', label: '탈퇴', count: stats?.withdrawn },
  ];

  // ─── 테이블 컬럼 ──────────────────────────────
  const columns = [
    {
      key: 'display_name',
      label: '회원',
      render: (row: MemberListItem) => (
        <div className="member-cell">
          {row.avatar_url ? (
            <img src={row.avatar_url} alt="" className="member-avatar" />
          ) : (
            <div className="member-avatar-placeholder">
              {(row.display_name ?? row.email)?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <div className="member-cell-name">{row.display_name ?? '-'}</div>
            <div className="member-cell-email">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'provider',
      label: '가입방법',
      render: (row: MemberListItem) => {
        const variant = row.provider === 'google' ? 'info' : row.provider === 'kakao' ? 'warning' : 'default';
        return <span className={`admin-badge admin-badge-${variant}`}>{PROVIDER_LABELS[row.provider] ?? row.provider}</span>;
      },
    },
    {
      key: 'status',
      label: '상태',
      render: (row: MemberListItem) => (
        <StatusBadge status={STATUS_LABELS[row.status] ?? row.status} variant={STATUS_VARIANTS[row.status]} />
      ),
    },
    {
      key: 'phone',
      label: '연락처',
      render: (row: MemberListItem) => row.phone ?? '-',
    },
    {
      key: 'order_count',
      label: '주문수',
      sortable: true,
      render: (row: MemberListItem) => `${row.order_count}건`,
    },
    {
      key: 'total_spent',
      label: '총 구매액',
      sortable: true,
      render: (row: MemberListItem) => formatCurrency(row.total_spent),
    },
    {
      key: 'created_at',
      label: '가입일',
      sortable: true,
      render: (row: MemberListItem) => formatDate(row.created_at),
    },
  ];

  // ─── Detail View ───────────────────────────────
  if (view === 'detail' && selectedMember) {
    return (
      <div className="admin-page">
        <button className="admin-btn admin-btn-ghost" onClick={closeDetail}>
          <ArrowLeft size={16} /> 목록으로
        </button>

        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">회원 상세 - {selectedMember.display_name ?? selectedMember.email}</h1>
            <p className="member-page-subtitle">{selectedMember.email}</p>
          </div>
          <div className="admin-page-header-actions">
            <StatusBadge status={STATUS_LABELS[selectedMember.status] ?? selectedMember.status} variant={STATUS_VARIANTS[selectedMember.status]} />
          </div>
        </div>

        {detailLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="member-info-grid">
            <div className="member-detail-col">
              <div className="admin-card">
                <h3 className="admin-card-title">회원 정보</h3>
                <div className="admin-card-body">
                  <div className="member-detail-header">
                    {selectedMember.avatar_url ? (
                      <img src={selectedMember.avatar_url} alt="" className="member-avatar member-avatar-lg" />
                    ) : (
                      <div className="member-avatar-placeholder member-avatar-placeholder-lg">
                        {(selectedMember.display_name ?? selectedMember.email)?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <div>
                      <div className="member-detail-name">{selectedMember.display_name ?? '-'}</div>
                      <div className="member-detail-email">{selectedMember.email}</div>
                    </div>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label"><Mail size={14} /> 이메일</span>
                    <span className="admin-detail-value">{selectedMember.email}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label"><Phone size={14} /> 연락처</span>
                    <span className="admin-detail-value">{selectedMember.phone ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">가입방법</span>
                    <span className="admin-detail-value">
                      <span className={`admin-badge admin-badge-${selectedMember.provider === 'google' ? 'info' : selectedMember.provider === 'kakao' ? 'warning' : 'default'}`}>
                        {PROVIDER_LABELS[selectedMember.provider] ?? selectedMember.provider}
                      </span>
                    </span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label"><Calendar size={14} /> 가입일</span>
                    <span className="admin-detail-value">{formatDate(selectedMember.created_at)}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">최근활동</span>
                    <span className="admin-detail-value">{formatDate(selectedMember.updated_at)}</span>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h3 className="admin-card-title">상태 관리</h3>
                <div className="admin-card-body">
                  <div className="member-status-section">
                    <span className="member-status-current">현재 상태:</span>
                    <StatusBadge status={STATUS_LABELS[selectedMember.status] ?? selectedMember.status} variant={STATUS_VARIANTS[selectedMember.status]} />
                  </div>
                  <div className="member-status-actions">
                    <select
                      className="admin-select"
                      value={statusChangeTarget}
                      onChange={(e) => setStatusChangeTarget(e.target.value)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      disabled={statusChangeTarget === selectedMember.status}
                      onClick={() => setShowStatusConfirm(true)}
                    >
                      상태 변경
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h3 className="admin-card-title"><FileText size={16} /> 관리자 메모</h3>
                <div className="admin-card-body">
                  <textarea
                    className="admin-textarea member-notes-textarea"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="관리자 메모를 입력하세요..."
                    rows={4}
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={handleNoteSave}
                    disabled={noteSaving || editNotes === (selectedMember.admin_notes ?? '')}
                  >
                    {noteSaving ? '저장 중...' : '메모 저장'}
                  </button>
                </div>
              </div>
            </div>

            <div className="member-detail-col">
              <div className="admin-card">
                <h3 className="admin-card-title">구매 통계</h3>
                <div className="admin-card-body">
                  <div className="member-purchase-stats">
                    <div className="member-purchase-stat">
                      <ShoppingBag size={24} className="member-purchase-stat-icon" />
                      <div className="member-purchase-stat-value">{memberDetail?.stats.order_count ?? selectedMember.order_count}</div>
                      <div className="member-purchase-stat-label">총 주문</div>
                    </div>
                    <div className="member-purchase-stat">
                      <CreditCard size={24} className="member-purchase-stat-icon" />
                      <div className="member-purchase-stat-value">{formatCurrency(memberDetail?.stats.total_spent ?? selectedMember.total_spent)}</div>
                      <div className="member-purchase-stat-label">총 구매액</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h3 className="admin-card-title">주문 내역</h3>
                <div className="admin-card-body">
                  {!memberDetail || memberDetail.orders.length === 0 ? (
                    <p className="member-orders-empty">주문 내역이 없습니다</p>
                  ) : (
                    <div className="admin-table-wrapper">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>주문번호</th>
                            <th>금액</th>
                            <th>상태</th>
                            <th>날짜</th>
                          </tr>
                        </thead>
                        <tbody>
                          {memberDetail.orders.map((order) => {
                            const statusVariant =
                              order.status === 'delivered' || order.status === 'paid' ? 'success'
                              : order.status === 'canceled' ? 'danger'
                              : order.status === 'shipped' || order.status === 'processing' ? 'info'
                              : 'warning';
                            return (
                              <tr key={order.id}>
                                <td>{order.order_number}</td>
                                <td>{formatCurrency(order.total_amount)}</td>
                                <td>
                                  <span className={`admin-badge admin-badge-${statusVariant}`}>
                                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                                  </span>
                                </td>
                                <td>{formatDate(order.created_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showStatusConfirm}
          title="회원 상태 변경"
          message={`"${selectedMember?.display_name ?? selectedMember?.email}" 회원의 상태를 "${STATUS_LABELS[statusChangeTarget]}"(으)로 변경하시겠습니까?`}
          confirmLabel="변경"
          cancelLabel="취소"
          variant={statusChangeTarget === 'suspended' || statusChangeTarget === 'withdrawn' ? 'danger' : 'default'}
          onConfirm={handleStatusChange}
          onCancel={() => setShowStatusConfirm(false)}
          loading={statusUpdating}
        />
      </div>
    );
  }

  // ─── List View ─────────────────────────────────
  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">회원 관리</h1>
        <span className="member-page-subtitle">총 {total}명</span>
      </div>

      {stats && (
        <div className="member-summary-stats">
          <StatCard icon={<Users size={18} />} label="전체 회원" value={stats.total} colorClass="member-stat-value-dark" />
          <StatCard icon={<UserCheck size={18} />} label="활성 회원" value={stats.active} colorClass="member-stat-value-green" />
          <StatCard icon={<AlertTriangle size={18} />} label="정지 회원" value={stats.suspended} colorClass="member-stat-value-red" alert={stats.suspended > 0} />
          <StatCard icon={<CreditCard size={18} />} label="총 매출" value={stats.total_revenue} colorClass="member-stat-value-purple" suffix="원" isCurrency />
        </div>
      )}

      <TabNav tabs={statusTabs} activeTab={statusFilter} onChange={setStatusFilter} />

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="이메일, 이름, 연락처 검색..." />
        <select className="admin-select" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <div className="member-toolbar-date">
          <input type="date" className="admin-input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="member-toolbar-date-sep">~</span>
          <input type="date" className="admin-input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <button type="button" className="admin-btn admin-btn-secondary member-export-btn" onClick={handleCsvExport} disabled={csvExporting}>
          <Download size={14} />
          {csvExporting ? '내보내는 중...' : 'CSV 내보내기'}
        </button>
      </div>

      {!loading && members.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="회원이 없습니다" description="조건에 맞는 회원이 없습니다" />
      ) : (
        <DataTable columns={columns} data={members} loading={loading} onRowClick={openDetail} onSort={handleSort} sortColumn={sortColumn} sortDirection={sortDir} />
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={PAGE_SIZE} totalItems={total} />
    </div>
  );
}
