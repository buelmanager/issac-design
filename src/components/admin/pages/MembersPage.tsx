import { useState, useEffect, useCallback } from 'react';
import { DataTable, SearchInput, Pagination, LoadingSpinner, EmptyState } from '../ui';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Users, X, Mail, Phone, Calendar, ShoppingBag, CreditCard } from 'lucide-react';

interface MemberListItem {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  provider: string;
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

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '결제 대기',
  paid: '결제 완료',
  processing: '처리중',
  shipped: '배송중',
  delivered: '배송 완료',
  canceled: '취소',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

export default function MembersPage() {
  const { accessToken } = useAuth();
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedMember, setSelectedMember] = useState<MemberListItem | null>(null);
  const [memberDetail, setMemberDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (providerFilter !== 'all') params.set('provider', providerFilter);
      params.set('sort', 'created_at');
      params.set('sort_dir', 'desc');

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
  }, [search, providerFilter, page, accessToken]);

  const openDetail = useCallback(async (member: MemberListItem) => {
    setSelectedMember(member);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/members?member_id=${member.id}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || 'Failed');
      setMemberDetail(json.data);
    } catch {
      toast.error('회원 상세 정보를 불러올 수 없습니다');
    }
    setDetailLoading(false);
  }, [accessToken]);

  const closeDetail = useCallback(() => {
    setSelectedMember(null);
    setMemberDetail(null);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    setPage(1);
  }, [search, providerFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    {
      key: 'display_name',
      label: '회원',
      render: (row: MemberListItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {row.avatar_url ? (
            <img
              src={row.avatar_url}
              alt=""
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 600,
                color: '#6b7280',
              }}
            >
              {(row.display_name ?? row.email)?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 500 }}>{row.display_name ?? '-'}</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'provider',
      label: '가입방법',
      render: (row: MemberListItem) => {
        const variant =
          row.provider === 'google' ? 'info' : row.provider === 'kakao' ? 'warning' : 'default';
        return (
          <span className={`admin-badge admin-badge-${variant}`}>
            {PROVIDER_LABELS[row.provider] ?? row.provider}
          </span>
        );
      },
    },
    {
      key: 'phone',
      label: '연락처',
      render: (row: MemberListItem) => row.phone ?? '-',
    },
    {
      key: 'order_count',
      label: '주문수',
      render: (row: MemberListItem) => `${row.order_count}건`,
    },
    {
      key: 'total_spent',
      label: '총 구매액',
      render: (row: MemberListItem) => formatCurrency(row.total_spent),
    },
    {
      key: 'created_at',
      label: '가입일',
      render: (row: MemberListItem) => formatDate(row.created_at),
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">회원 관리</h1>
        <span style={{ fontSize: 14, color: '#6b7280' }}>총 {total}명</span>
      </div>

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="이메일, 이름, 연락처 검색..." />
        <select
          className="admin-select"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {!loading && members.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="회원이 없습니다"
          description="아직 가입한 회원이 없습니다"
        />
      ) : (
        <DataTable columns={columns} data={members} loading={loading} onRowClick={openDetail} />
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        totalItems={total}
      />

      {selectedMember && (
        <div className="admin-modal-overlay" onClick={closeDetail}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">회원 상세 정보</h2>
              <button type="button" className="admin-btn-icon" onClick={closeDetail}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              {detailLoading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <div className="admin-card">
                    <h3 className="admin-card-title">회원 정보</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 16 }}>
                      {selectedMember.avatar_url ? (
                        <img
                          src={selectedMember.avatar_url}
                          alt=""
                          style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            background: '#e5e7eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            fontWeight: 600,
                            color: '#6b7280',
                          }}
                        >
                          {(selectedMember.display_name ?? selectedMember.email)?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>
                          {selectedMember.display_name ?? '-'}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>{selectedMember.email}</div>
                      </div>
                    </div>
                    <div className="admin-detail-row">
                      <span className="admin-detail-label">
                        <Mail size={14} /> 이메일
                      </span>
                      <span className="admin-detail-value">{selectedMember.email}</span>
                    </div>
                    <div className="admin-detail-row">
                      <span className="admin-detail-label">
                        <Phone size={14} /> 연락처
                      </span>
                      <span className="admin-detail-value">{selectedMember.phone ?? '-'}</span>
                    </div>
                    <div className="admin-detail-row">
                      <span className="admin-detail-label">가입방법</span>
                      <span className="admin-detail-value">
                        <span
                          className={`admin-badge admin-badge-${selectedMember.provider === 'google' ? 'info' : selectedMember.provider === 'kakao' ? 'warning' : 'default'}`}
                        >
                          {PROVIDER_LABELS[selectedMember.provider] ?? selectedMember.provider}
                        </span>
                      </span>
                    </div>
                    <div className="admin-detail-row">
                      <span className="admin-detail-label">
                        <Calendar size={14} /> 가입일
                      </span>
                      <span className="admin-detail-value">{formatDate(selectedMember.created_at)}</span>
                    </div>
                    <div className="admin-detail-row">
                      <span className="admin-detail-label">최근활동</span>
                      <span className="admin-detail-value">{formatDate(selectedMember.updated_at)}</span>
                    </div>
                  </div>

                  <div className="admin-card">
                    <h3 className="admin-card-title">구매 통계</h3>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <ShoppingBag size={20} style={{ color: '#6b7280', marginBottom: 4 }} />
                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                          {memberDetail?.stats.order_count ?? selectedMember.order_count}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>총 주문</div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'center' }}>
                        <CreditCard size={20} style={{ color: '#6b7280', marginBottom: 4 }} />
                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                          {formatCurrency(memberDetail?.stats.total_spent ?? selectedMember.total_spent)}
                        </div>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>총 구매액</div>
                      </div>
                    </div>
                  </div>

                  <div className="admin-card">
                    <h3 className="admin-card-title">주문 내역</h3>
                    {!memberDetail || memberDetail.orders.length === 0 ? (
                      <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                        주문 내역이 없습니다
                      </p>
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
                                order.status === 'delivered' || order.status === 'paid'
                                  ? 'success'
                                  : order.status === 'canceled'
                                    ? 'danger'
                                    : order.status === 'shipped' || order.status === 'processing'
                                      ? 'info'
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
