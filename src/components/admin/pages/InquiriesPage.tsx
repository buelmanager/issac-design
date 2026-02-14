import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { ContactInquiry, InquiryStatus } from '../../../types/admin';
import { DataTable, SearchInput, StatusBadge, Pagination, LoadingSpinner, EmptyState } from '../ui';
import toast from 'react-hot-toast';
import { MessageSquare, X, Save } from 'lucide-react';

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'new', label: '신규' },
  { value: 'read', label: '확인' },
  { value: 'replied', label: '답변완료' },
  { value: 'closed', label: '종료' },
];

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: '신규',
  read: '확인',
  replied: '답변완료',
  closed: '종료',
};

const INQUIRY_STATUS_LIST: InquiryStatus[] = ['new', 'read', 'replied', 'closed'];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedInquiry, setSelectedInquiry] = useState<ContactInquiry | null>(null);
  const [detailStatus, setDetailStatus] = useState<InquiryStatus>('new');
  const [detailNotes, setDetailNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('contact_inquiries')
      .select('id, name, email, phone, inquiry_type, message, status, admin_notes, created_at', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,message.ilike.%${search}%`);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    query = query.order('created_at', { ascending: false });
    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) {
      toast.error('문의 목록을 불러올 수 없습니다');
    } else {
      setInquiries(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const openDetail = useCallback((inquiry: ContactInquiry) => {
    setSelectedInquiry(inquiry);
    setDetailStatus(inquiry.status as InquiryStatus);
    setDetailNotes(inquiry.admin_notes ?? '');
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedInquiry(null);
  }, []);

  const handleStatusChange = useCallback(async (id: string, newStatus: InquiryStatus) => {
    const { error } = await supabase
      .from('contact_inquiries')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      toast.error('상태 변경에 실패했습니다');
    } else {
      toast.success('상태가 변경되었습니다');
      setDetailStatus(newStatus);
      fetchInquiries();
    }
  }, [fetchInquiries]);

  const handleSaveNotes = useCallback(async () => {
    if (!selectedInquiry) return;
    setSaving(true);
    const { error } = await supabase
      .from('contact_inquiries')
      .update({ admin_notes: detailNotes })
      .eq('id', selectedInquiry.id);
    if (error) {
      toast.error('메모 저장에 실패했습니다');
    } else {
      toast.success('메모가 저장되었습니다');
      fetchInquiries();
    }
    setSaving(false);
  }, [selectedInquiry, detailNotes, fetchInquiries]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    { key: 'name', label: '이름' },
    {
      key: 'inquiry_type',
      label: '문의 유형',
      render: (row: ContactInquiry) => row.inquiry_type ?? '-',
    },
    {
      key: 'message',
      label: '내용',
      render: (row: ContactInquiry) => truncate(row.message, 100),
    },
    {
      key: 'status',
      label: '상태',
      render: (row: ContactInquiry) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      label: '접수일',
      render: (row: ContactInquiry) => formatDate(row.created_at),
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">문의 관리</h1>
      </div>

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="이름, 내용 검색..." />
        <select
          className="admin-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {!loading && inquiries.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={48} />}
          title="문의가 없습니다"
          description="아직 접수된 문의가 없습니다"
        />
      ) : (
        <DataTable
          columns={columns}
          data={inquiries}
          loading={loading}
          onRowClick={openDetail}
        />
      )}

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={PAGE_SIZE}
        totalItems={total}
      />

      {selectedInquiry && (
        <div className="admin-modal-overlay" onClick={closeDetail}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">문의 상세</h2>
              <button type="button" className="admin-btn-icon" onClick={closeDetail}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-card">
                <h3 className="admin-card-title">문의자 정보</h3>
                <div className="admin-form">
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">이름</span>
                    <span className="admin-detail-value">{selectedInquiry.name}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">이메일</span>
                    <span className="admin-detail-value">{selectedInquiry.email ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">전화번호</span>
                    <span className="admin-detail-value">{selectedInquiry.phone ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">문의 유형</span>
                    <span className="admin-detail-value">{selectedInquiry.inquiry_type ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">접수일시</span>
                    <span className="admin-detail-value">{formatDateTime(selectedInquiry.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h3 className="admin-card-title">문의 내용</h3>
                <p className="admin-detail-message">{selectedInquiry.message}</p>
              </div>

              <div className="admin-card">
                <h3 className="admin-card-title">상태 관리</h3>
                <div className="admin-form">
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">상태</span>
                    <select
                      className="admin-select"
                      value={detailStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value as InquiryStatus;
                        setDetailStatus(newStatus);
                        handleStatusChange(selectedInquiry.id, newStatus);
                      }}
                    >
                      {INQUIRY_STATUS_LIST.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h3 className="admin-card-title">관리자 메모</h3>
                <div className="admin-form">
                  <textarea
                    className="admin-textarea"
                    rows={4}
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    placeholder="관리자 메모를 입력하세요..."
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={handleSaveNotes}
                    disabled={saving}
                  >
                    {saving ? <LoadingSpinner size="sm" /> : <Save size={16} />}
                    메모 저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
