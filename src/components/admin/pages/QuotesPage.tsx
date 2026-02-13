import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import type { QuoteRequest, QuoteStatus } from '../../../types/admin';
import type { Json } from '../../../types/database';
import { DataTable, SearchInput, StatusBadge, Pagination, LoadingSpinner, EmptyState } from '../ui';
import toast from 'react-hot-toast';
import { FileText, X, Save, Paperclip, Download } from 'lucide-react';

const PAGE_SIZE = 20;

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '대기' },
  { value: 'reviewing', label: '검토중' },
  { value: 'quoted', label: '견적완료' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  pending: '대기',
  reviewing: '검토중',
  quoted: '견적완료',
  completed: '완료',
  cancelled: '취소',
};

const QUOTE_STATUS_LIST: QuoteStatus[] = ['pending', 'reviewing', 'quoted', 'completed', 'cancelled'];

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

function parseJsonArray(val: Json): Json[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore parse errors
    }
  }
  return [];
}

function getProductName(item: Json): string {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null && 'name' in item) {
    return String((item as Record<string, Json | undefined>).name ?? '');
  }
  return String(item ?? '');
}

function getProductSummary(products: Json): string {
  const arr = parseJsonArray(products);
  if (arr.length === 0) return '-';
  const firstName = getProductName(arr[0]);
  if (arr.length === 1) return firstName;
  return `${firstName} 외 ${arr.length - 1}건`;
}

function getAttachmentUrls(attachments: Json): string[] {
  const arr = parseJsonArray(attachments);
  return arr.filter((item): item is string => typeof item === 'string');
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequest | null>(null);
  const [detailStatus, setDetailStatus] = useState<QuoteStatus>('pending');
  const [detailNotes, setDetailNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('quote_requests')
      .select('id, customer_name, email, phone, business_name, request_type, products, message, attachments, status, admin_notes, created_at, updated_at', { count: 'exact' });

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,business_name.ilike.%${search}%`);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    query = query.order('created_at', { ascending: false });
    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) {
      toast.error('견적 요청 목록을 불러올 수 없습니다');
    } else {
      setQuotes(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const openDetail = useCallback((quote: QuoteRequest) => {
    setSelectedQuote(quote);
    setDetailStatus(quote.status as QuoteStatus);
    setDetailNotes(quote.admin_notes ?? '');
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedQuote(null);
  }, []);

  const handleStatusChange = useCallback(async (id: string, newStatus: QuoteStatus) => {
    const { error } = await supabase
      .from('quote_requests')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error('상태 변경에 실패했습니다');
    } else {
      toast.success('상태가 변경되었습니다');
      setDetailStatus(newStatus);
      fetchQuotes();
    }
  }, [fetchQuotes]);

  const handleSaveNotes = useCallback(async () => {
    if (!selectedQuote) return;
    setSaving(true);
    const { error } = await supabase
      .from('quote_requests')
      .update({ admin_notes: detailNotes, updated_at: new Date().toISOString() })
      .eq('id', selectedQuote.id);
    if (error) {
      toast.error('메모 저장에 실패했습니다');
    } else {
      toast.success('메모가 저장되었습니다');
      fetchQuotes();
    }
    setSaving(false);
  }, [selectedQuote, detailNotes, fetchQuotes]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    { key: 'customer_name', label: '고객명' },
    {
      key: 'business_name',
      label: '업체명',
      render: (row: QuoteRequest) => row.business_name ?? '-',
    },
    {
      key: 'contact',
      label: '연락처',
      render: (row: QuoteRequest) => {
        const parts: string[] = [];
        if (row.phone) parts.push(row.phone);
        if (row.email) parts.push(row.email);
        return parts.length > 0 ? parts.join(' / ') : '-';
      },
    },
    {
      key: 'products',
      label: '제품',
      render: (row: QuoteRequest) => getProductSummary(row.products),
    },
    {
      key: 'status',
      label: '상태',
      render: (row: QuoteRequest) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      label: '요청일',
      render: (row: QuoteRequest) => formatDate(row.created_at),
    },
  ];

  const productsList = selectedQuote ? parseJsonArray(selectedQuote.products) : [];
  const attachmentUrls = selectedQuote ? getAttachmentUrls(selectedQuote.attachments) : [];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">견적 요청 관리</h1>
      </div>

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="고객명, 업체명 검색..." />
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

      {!loading && quotes.length === 0 ? (
        <EmptyState
          icon={<FileText size={48} />}
          title="견적 요청이 없습니다"
          description="아직 접수된 견적 요청이 없습니다"
        />
      ) : (
        <DataTable
          columns={columns}
          data={quotes}
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

      {selectedQuote && (
        <div className="admin-modal-overlay" onClick={closeDetail}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">견적 요청 상세</h2>
              <button type="button" className="admin-btn-icon" onClick={closeDetail}>
                <X size={20} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-card">
                <h3 className="admin-card-title">고객 정보</h3>
                <div className="admin-form">
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">고객명</span>
                    <span className="admin-detail-value">{selectedQuote.customer_name}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">업체명</span>
                    <span className="admin-detail-value">{selectedQuote.business_name ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">전화번호</span>
                    <span className="admin-detail-value">{selectedQuote.phone ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">이메일</span>
                    <span className="admin-detail-value">{selectedQuote.email ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">요청 유형</span>
                    <span className="admin-detail-value">{selectedQuote.request_type ?? '-'}</span>
                  </div>
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">요청일시</span>
                    <span className="admin-detail-value">{formatDateTime(selectedQuote.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <h3 className="admin-card-title">요청 제품</h3>
                {productsList.length === 0 ? (
                  <p className="admin-text-muted">요청된 제품이 없습니다</p>
                ) : (
                  <ul className="admin-detail-list">
                    {productsList.map((item, idx) => {
                      const name = getProductName(item);
                      const qty = typeof item === 'object' && item !== null && 'quantity' in item
                        ? String((item as Record<string, Json | undefined>).quantity ?? '')
                        : '';
                      return (
                        <li key={idx} className="admin-detail-list-item">
                          {name}{qty ? ` (${qty}개)` : ''}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {selectedQuote.message && (
                <div className="admin-card">
                  <h3 className="admin-card-title">요청 메시지</h3>
                  <p className="admin-detail-message">{selectedQuote.message}</p>
                </div>
              )}

              {attachmentUrls.length > 0 && (
                <div className="admin-card">
                  <h3 className="admin-card-title">
                    <Paperclip size={16} /> 첨부파일 ({attachmentUrls.length})
                  </h3>
                  <ul className="admin-detail-list">
                    {attachmentUrls.map((url, idx) => {
                      const filename = url.split('/').pop() ?? `파일 ${idx + 1}`;
                      return (
                        <li key={idx} className="admin-detail-list-item">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="admin-link">
                            <Download size={14} /> {filename}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="admin-card">
                <h3 className="admin-card-title">상태 관리</h3>
                <div className="admin-form">
                  <div className="admin-detail-row">
                    <span className="admin-detail-label">상태</span>
                    <select
                      className="admin-select"
                      value={detailStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value as QuoteStatus;
                        setDetailStatus(newStatus);
                        handleStatusChange(selectedQuote.id, newStatus);
                      }}
                    >
                      {QUOTE_STATUS_LIST.map((s) => (
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
