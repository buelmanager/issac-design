import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { QuoteRequest, QuoteStatus } from '../../../types/admin';
import type { Json } from '../../../types/database';
import { DataTable, SearchInput, StatusBadge, Pagination, LoadingSpinner, EmptyState } from '../ui';
import toast from 'react-hot-toast';
import { FileText, ArrowLeft, Save, Paperclip, Download, Package, MessageSquare, User, DollarSign } from 'lucide-react';

type ViewMode = 'list' | 'detail';

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

const STATUS_VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  pending: 'warning',
  reviewing: 'info',
  quoted: 'default',
  completed: 'success',
  cancelled: 'danger',
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
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, Json | undefined>;
    // cart items use 'productName', manual entries may use 'name'
    const name = obj.productName ?? obj.name ?? '';
    return String(name);
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

interface QuotedItem {
  productId: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  note: string;
}

function formatCurrency(n: number): string {
  return `₩${new Intl.NumberFormat('ko-KR').format(n)}`;
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
  const [savingPricing, setSavingPricing] = useState(false);
  const [view, setView] = useState<ViewMode>('list');
  const [quotedItems, setQuotedItems] = useState<QuotedItem[]>([]);
  const [totalQuotedPrice, setTotalQuotedPrice] = useState(0);

  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('quote_requests')
      .select('id, customer_name, email, phone, business_name, request_type, products, message, attachments, status, admin_notes, created_at, updated_at, quoted_items, quoted_price, quoted_at, user_id', { count: 'exact' });

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

  const initQuotedItems = useCallback((quote: QuoteRequest): QuotedItem[] => {
    const existingItems = parseJsonArray(quote.quoted_items as Json);
    if (existingItems.length > 0) {
      return existingItems.map((item) => {
        const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, Json | undefined>;
        return {
          productId: String(obj.productId ?? ''),
          unitPrice: Number(obj.unitPrice ?? 0),
          quantity: Number(obj.quantity ?? 1),
          subtotal: Number(obj.subtotal ?? 0),
          note: String(obj.note ?? ''),
        };
      });
    }
    const products = parseJsonArray(quote.products);
    return products.map((item) => {
      const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, Json | undefined>;
      return {
        productId: String(obj.productId ?? ''),
        unitPrice: 0,
        quantity: Number(obj.quantity ?? 1),
        subtotal: 0,
        note: '',
      };
    });
  }, []);

  const openDetail = useCallback((quote: QuoteRequest) => {
    setSelectedQuote(quote);
    setDetailStatus(quote.status as QuoteStatus);
    setDetailNotes(quote.admin_notes ?? '');
    const items = initQuotedItems(quote);
    setQuotedItems(items);
    setTotalQuotedPrice(items.reduce((sum, i) => sum + i.subtotal, 0));
    setView('detail');
  }, [initQuotedItems]);

  const closeDetail = useCallback(() => {
    setView('list');
    setSelectedQuote(null);
  }, []);

  const handleStatusChange = useCallback(async (id: string, newStatus: QuoteStatus) => {
    const now = new Date().toISOString();
    const updateData: Record<string, string> = { status: newStatus, updated_at: now };
    if (newStatus === 'quoted') {
      updateData.quoted_at = now;
    }
    const { error } = await supabase
      .from('quote_requests')
      .update(updateData)
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

  const handleQuotedItemChange = useCallback((index: number, field: 'unitPrice' | 'quantity' | 'note', value: number | string) => {
    setQuotedItems((prev) => {
      const updated = prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item };
        if (field === 'unitPrice') {
          next.unitPrice = Number(value) || 0;
          next.subtotal = next.unitPrice * next.quantity;
        } else if (field === 'quantity') {
          next.quantity = Number(value) || 0;
          next.subtotal = next.unitPrice * next.quantity;
        } else {
          next.note = String(value);
        }
        return next;
      });
      setTotalQuotedPrice(updated.reduce((sum, item) => sum + item.subtotal, 0));
      return updated;
    });
  }, []);

  const handleSavePricing = useCallback(async () => {
    if (!selectedQuote) return;
    setSavingPricing(true);
    const { error } = await supabase
      .from('quote_requests')
      .update({
        quoted_items: quotedItems as unknown as Json,
        quoted_price: totalQuotedPrice,
        quoted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedQuote.id);
    if (error) {
      toast.error('견적 금액 저장에 실패했습니다');
    } else {
      toast.success('견적 금액이 저장되었습니다');
      fetchQuotes();
    }
    setSavingPricing(false);
  }, [selectedQuote, quotedItems, totalQuotedPrice, fetchQuotes]);

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
      render: (row: QuoteRequest) => (
        <StatusBadge
          status={STATUS_LABELS[row.status as QuoteStatus] ?? row.status}
          variant={STATUS_VARIANTS[row.status] ?? 'default'}
        />
      ),
    },
    {
      key: 'created_at',
      label: '요청일',
      render: (row: QuoteRequest) => formatDate(row.created_at),
    },
  ];

  if (view === 'detail' && selectedQuote) {
    const productsList = parseJsonArray(selectedQuote.products);
    const attachmentUrls = getAttachmentUrls(selectedQuote.attachments);

    return (
      <div className="admin-page">
        <button className="admin-btn admin-btn-ghost" onClick={closeDetail}>
          <ArrowLeft size={16} /> 목록으로
        </button>

        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">견적 요청 상세 - {selectedQuote.customer_name}</h1>
            <p className="quote-page-subtitle">요청일: {formatDateTime(selectedQuote.created_at)}</p>
          </div>
          <div className="admin-page-header-actions">
            <StatusBadge
              status={STATUS_LABELS[detailStatus] ?? detailStatus}
              variant={STATUS_VARIANTS[detailStatus] ?? 'default'}
            />
          </div>
        </div>

        <div className="quote-info-grid">
          <div className="quote-detail-col">
            <div className="admin-card">
              <h3 className="admin-card-title"><User size={18} /> 고객 정보</h3>
              <div className="admin-card-body">
                <div className="admin-detail-row"><span className="admin-detail-label">고객명</span><span className="admin-detail-value">{selectedQuote.customer_name}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">업체명</span><span className="admin-detail-value">{selectedQuote.business_name ?? '-'}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">전화번호</span><span className="admin-detail-value">{selectedQuote.phone ?? '-'}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">이메일</span><span className="admin-detail-value">{selectedQuote.email ?? '-'}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">요청 유형</span><span className="admin-detail-value">{selectedQuote.request_type ?? '-'}</span></div>
                <div className="admin-detail-row"><span className="admin-detail-label">요청일시</span><span className="admin-detail-value">{formatDateTime(selectedQuote.created_at)}</span></div>
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title"><Package size={18} /> 요청 제품</h3>
              <div className="admin-card-body">
                {productsList.length === 0 ? (
                  <p className="quote-empty-text">요청된 제품이 없습니다</p>
                ) : (
                  <ul className="quote-product-list">
                    {productsList.map((item, idx) => {
                      const name = getProductName(item);
                      const obj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, Json | undefined>;
                      const qty = obj.quantity ? String(obj.quantity) : '';
                      const opts = (typeof obj.options === 'object' && obj.options !== null ? obj.options : {}) as Record<string, string | undefined>;
                      const optionParts = [opts.size, opts.material, opts.finish, opts.lighting].filter(Boolean);
                      const category = obj.categoryName ? String(obj.categoryName) : '';
                      const price = obj.priceRange ? String(obj.priceRange) : '';
                      return (
                        <li key={idx} className="quote-product-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                            <Package size={16} className="quote-product-item-icon" />
                            <span className="quote-product-item-name" style={{ flex: 1 }}>{name}</span>
                            {qty && <span className="quote-product-item-qty">{qty}개</span>}
                          </div>
                          {(optionParts.length > 0 || category || price) && (
                            <div style={{ paddingLeft: '24px', fontSize: '12px', color: 'var(--admin-text-muted, #6b7280)' }}>
                              {category && <span style={{ marginRight: '8px' }}>{category}</span>}
                              {optionParts.length > 0 && <span style={{ marginRight: '8px' }}>{optionParts.join(' / ')}</span>}
                              {price && <span style={{ fontWeight: 500 }}>{price}</span>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {selectedQuote.message && (
              <div className="admin-card">
                <h3 className="admin-card-title"><MessageSquare size={18} /> 요청 메시지</h3>
                <div className="admin-card-body">
                  <div className="quote-message-box">{selectedQuote.message}</div>
                </div>
              </div>
            )}

            {attachmentUrls.length > 0 && (
              <div className="admin-card">
                <h3 className="admin-card-title"><Paperclip size={18} /> 첨부파일 ({attachmentUrls.length})</h3>
                <div className="admin-card-body">
                  <ul className="quote-attachment-list">
                    {attachmentUrls.map((url, idx) => {
                      const filename = url.split('/').pop() ?? `파일 ${idx + 1}`;
                      return (
                        <li key={idx} className="quote-attachment-item">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="quote-attachment-link">
                            <Download size={14} /> {filename}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="quote-detail-col">
            <div className="admin-card">
              <h3 className="admin-card-title">상태 관리</h3>
              <div className="admin-card-body">
                <div className="quote-status-section">
                  <span className="quote-status-label">현재 상태:</span>
                  <StatusBadge
                    status={STATUS_LABELS[detailStatus] ?? detailStatus}
                    variant={STATUS_VARIANTS[detailStatus] ?? 'default'}
                  />
                </div>
                <div className="quote-status-actions">
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
              <h3 className="admin-card-title"><DollarSign size={18} /> 견적 금액 입력</h3>
              <div className="admin-card-body">
                {quotedItems.length === 0 ? (
                  <p className="quote-empty-text">견적 항목이 없습니다</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {quotedItems.map((qItem, idx) => {
                      const productName = idx < productsList.length ? getProductName(productsList[idx]) : `항목 ${idx + 1}`;
                      return (
                        <div key={idx} style={{ padding: '12px', background: 'var(--admin-bg-subtle, #f9fafb)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--admin-text, #111827)' }}>{productName}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--admin-text-muted, #6b7280)', marginBottom: '2px', display: 'block' }}>단가 (₩)</label>
                              <input
                                type="number"
                                className="admin-input"
                                value={qItem.unitPrice || ''}
                                onChange={(e) => handleQuotedItemChange(idx, 'unitPrice', e.target.value)}
                                placeholder="0"
                                min={0}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '11px', color: 'var(--admin-text-muted, #6b7280)', marginBottom: '2px', display: 'block' }}>수량</label>
                              <input
                                type="number"
                                className="admin-input"
                                value={qItem.quantity || ''}
                                onChange={(e) => handleQuotedItemChange(idx, 'quantity', e.target.value)}
                                placeholder="1"
                                min={0}
                              />
                            </div>
                          </div>
                          <div className="admin-detail-row">
                            <span className="admin-detail-label">소계</span>
                            <span className="admin-detail-value" style={{ fontWeight: 600 }}>{formatCurrency(qItem.subtotal)}</span>
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--admin-text-muted, #6b7280)', marginBottom: '2px', display: 'block' }}>비고</label>
                            <input
                              type="text"
                              className="admin-input"
                              value={qItem.note}
                              onChange={(e) => handleQuotedItemChange(idx, 'note', e.target.value)}
                              placeholder="항목 비고..."
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="admin-detail-row" style={{ marginTop: '16px', padding: '12px', background: 'var(--admin-bg-subtle, #f9fafb)', borderRadius: '8px' }}>
                  <span className="admin-detail-label" style={{ fontWeight: 700, fontSize: '14px' }}>총 견적 금액</span>
                  <span className="admin-detail-value" style={{ fontWeight: 700, fontSize: '16px', color: 'var(--admin-primary, #2563eb)' }}>{formatCurrency(totalQuotedPrice)}</span>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={handleSavePricing}
                  disabled={savingPricing}
                  style={{ marginTop: '12px' }}
                >
                  {savingPricing ? <LoadingSpinner size="sm" /> : <Save size={16} />}
                  견적 저장
                </button>
              </div>
            </div>

            <div className="admin-card">
              <h3 className="admin-card-title"><FileText size={18} /> 관리자 메모</h3>
              <div className="admin-card-body">
                <textarea
                  className="admin-textarea quote-notes-textarea"
                  rows={6}
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
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">견적 요청 관리</h1>
          <p className="quote-page-subtitle">총 {total}건의 견적 요청</p>
        </div>
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
    </div>
  );
}
