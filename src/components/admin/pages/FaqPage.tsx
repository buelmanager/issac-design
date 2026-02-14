import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { LandingFaq, FaqCategory, FaqItem } from '../../../types/admin';
import type { Database } from '../../../types/database';
import { TabNav, DragSortList, Toggle, ConfirmModal, LoadingSpinner, EmptyState } from '../ui';
import { Plus, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const FAQ_TABS = [
  { key: 'landing', label: '랜딩 FAQ' },
  { key: 'shop', label: '쇼핑몰 FAQ' },
];

function LandingFaqTab() {
  const [faqs, setFaqs] = useState<LandingFaq[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LandingFaq | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('landing_faqs')
      .select('*')
      .order('order_index');
    if (error) {
      toast.error('랜딩 FAQ 로드 실패');
      setLoading(false);
      return;
    }
    setFaqs((data ?? []) as LandingFaq[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleFieldChange(id: string, field: 'question' | 'answer', value: string) {
    setFaqs((prev) =>
      prev.map((faq) => (faq.id === id ? { ...faq, [field]: value } : faq))
    );
  }

  function handleReorder(reordered: LandingFaq[]) {
    setFaqs(reordered);
  }

  async function handleToggleVisibility(faq: LandingFaq) {
    const { error } = await supabase
      .from('landing_faqs')
      .update({ is_visible: !faq.is_visible, updated_at: new Date().toISOString() })
      .eq('id', faq.id);

    if (error) {
      toast.error('변경 실패');
      return;
    }

    setFaqs((prev) =>
      prev.map((f) => (f.id === faq.id ? { ...f, is_visible: !faq.is_visible } : f))
    );
  }

  async function handleSaveAll() {
    setSaving(true);
    const updates = faqs.map((faq, idx) =>
      supabase
        .from('landing_faqs')
        .update({
          question: faq.question,
          answer: faq.answer,
          order_index: idx,
          updated_at: new Date().toISOString(),
        })
        .eq('id', faq.id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      toast.error('저장 실패');
    } else {
      toast.success('랜딩 FAQ가 저장되었습니다');
    }
    setSaving(false);
  }

  async function handleAdd() {
    const maxOrder = faqs.length > 0 ? Math.max(...faqs.map((f) => f.order_index)) + 1 : 0;
    const insertData: Database['public']['Tables']['landing_faqs']['Insert'] = {
      question: '새 질문',
      answer: '답변을 입력하세요',
      order_index: maxOrder,
    };
    const { error } = await supabase.from('landing_faqs').insert(insertData);
    if (error) {
      toast.error('추가 실패');
      return;
    }
    toast.success('FAQ가 추가되었습니다');
    fetchData();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('landing_faqs').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제 실패');
      setDeleteTarget(null);
      return;
    }
    setFaqs((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('FAQ가 삭제되었습니다');
  }

  if (loading) return <LoadingSpinner size="md" />;

  return (
    <div>
      <div className="admin-card-header">
        <button type="button" className="admin-btn admin-btn-primary" onClick={handleAdd}>
          <Plus size={16} />
          FAQ 추가
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={handleSaveAll}
          disabled={saving}
        >
          <Save size={16} />
          {saving ? '저장 중...' : '전체 저장'}
        </button>
      </div>

      {faqs.length === 0 ? (
        <EmptyState
          title="랜딩 FAQ가 없습니다"
          action={{ label: 'FAQ 추가', onClick: handleAdd }}
        />
      ) : (
        <DragSortList
          items={faqs}
          keyExtractor={(faq) => faq.id}
          onReorder={handleReorder}
          renderItem={(faq) => (
            <div className={`admin-faq-accordion-item${expandedId === faq.id ? ' expanded' : ''}`}>
              <button
                type="button"
                className="admin-faq-accordion-header"
                onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
              >
                <span className="admin-faq-accordion-question">
                  {faq.question || '질문 없음'}
                </span>
                <span className="admin-faq-accordion-indicators">
                  {!faq.is_visible && <span className="admin-faq-hidden-badge">숨김</span>}
                  {expandedId === faq.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              <div className={`admin-faq-accordion-body${expandedId === faq.id ? ' open' : ''}`}>
                <div className="admin-faq-accordion-content">
                  <div className="admin-form-field">
                    <label className="admin-form-label">질문</label>
                    <textarea
                      className="admin-textarea"
                      value={faq.question}
                      onChange={(e) => handleFieldChange(faq.id, 'question', e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="admin-form-field">
                    <label className="admin-form-label">답변</label>
                    <textarea
                      className="admin-textarea"
                      value={faq.answer}
                      onChange={(e) => handleFieldChange(faq.id, 'answer', e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="admin-faq-item-actions">
                    <Toggle
                      checked={faq.is_visible}
                      onChange={() => handleToggleVisibility(faq)}
                      label="표시"
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-icon admin-btn-danger"
                      onClick={() => setDeleteTarget(faq)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        />
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="FAQ 삭제"
        message={`'${deleteTarget?.question}' FAQ를 삭제하시겠습니까?`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ShopFaqTab() {
  const [categories, setCategories] = useState<FaqCategory[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);
  const [deleteCatTarget, setDeleteCatTarget] = useState<FaqCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FaqItem | null>(null);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from('faq_categories').select('*').order('order_index'),
      supabase.from('faq_items').select('*').order('order_index'),
    ]);

    if (catsRes.error || itemsRes.error) {
      toast.error('쇼핑몰 FAQ 로드 실패');
      setLoading(false);
      return;
    }

    const catList = (catsRes.data ?? []) as FaqCategory[];
    const itemList = (itemsRes.data ?? []) as FaqItem[];
    setCategories(catList);
    setFaqItems(itemList);
    if (catList.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(catList[0].id);
    }
    setLoading(false);
  }, [selectedCategoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredFaqs = faqItems.filter((item) => item.category_id === selectedCategoryId);

  function handleCatStartEdit(cat: FaqCategory) {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
  }

  async function handleCatSaveEdit(id: string) {
    const { error } = await supabase
      .from('faq_categories')
      .update({ name: editCatName })
      .eq('id', id);

    if (error) {
      toast.error('카테고리 수정 실패');
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: editCatName } : c))
    );
    setEditingCatId(null);
    toast.success('카테고리가 수정되었습니다');
  }

  function handleCatReorder(reordered: FaqCategory[]) {
    setCategories(reordered);
  }

  async function handleSaveCatOrder() {
    const updates = categories.map((cat, idx) =>
      supabase.from('faq_categories').update({ order_index: idx }).eq('id', cat.id)
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) {
      toast.error('순서 저장 실패');
    } else {
      toast.success('카테고리 순서가 저장되었습니다');
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim()) {
      toast.error('카테고리명을 입력하세요');
      return;
    }
    const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.order_index)) + 1 : 0;
    const insertData: Database['public']['Tables']['faq_categories']['Insert'] = {
      id: `faqcat_${Date.now()}`,
      name: newCatName.trim(),
      order_index: maxOrder,
    };
    const { error } = await supabase.from('faq_categories').insert(insertData);
    if (error) {
      toast.error('카테고리 추가 실패');
      return;
    }
    setNewCatName('');
    setShowAddCat(false);
    toast.success('카테고리가 추가되었습니다');
    fetchData();
  }

  async function handleDeleteCategory() {
    if (!deleteCatTarget) return;
    const { error } = await supabase.from('faq_categories').delete().eq('id', deleteCatTarget.id);
    if (error) {
      toast.error('카테고리 삭제 실패');
      setDeleteCatTarget(null);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== deleteCatTarget.id));
    if (selectedCategoryId === deleteCatTarget.id) {
      const remaining = categories.filter((c) => c.id !== deleteCatTarget.id);
      setSelectedCategoryId(remaining.length > 0 ? remaining[0].id : null);
    }
    setDeleteCatTarget(null);
    toast.success('카테고리가 삭제되었습니다');
  }

  function handleFaqFieldChange(id: string, field: 'question' | 'answer', value: string) {
    setFaqItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  async function handleToggleFaqVisibility(faq: FaqItem) {
    const { error } = await supabase
      .from('faq_items')
      .update({ is_visible: !faq.is_visible, updated_at: new Date().toISOString() })
      .eq('id', faq.id);

    if (error) {
      toast.error('변경 실패');
      return;
    }

    setFaqItems((prev) =>
      prev.map((item) => (item.id === faq.id ? { ...item, is_visible: !faq.is_visible } : item))
    );
  }

  async function handleAddFaq() {
    if (!selectedCategoryId) return;
    const maxOrder = filteredFaqs.length > 0
      ? Math.max(...filteredFaqs.map((f) => f.order_index)) + 1
      : 0;

    const insertData: Database['public']['Tables']['faq_items']['Insert'] = {
      id: `faq_${Date.now()}`,
      category_id: selectedCategoryId,
      question: '새 질문',
      answer: '답변을 입력하세요',
      order_index: maxOrder,
    };
    const { error } = await supabase.from('faq_items').insert(insertData);
    if (error) {
      toast.error('FAQ 추가 실패');
      return;
    }
    toast.success('FAQ가 추가되었습니다');
    fetchData();
  }

  async function handleDeleteFaq() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('faq_items').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제 실패');
      setDeleteTarget(null);
      return;
    }
    setFaqItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('FAQ가 삭제되었습니다');
  }

  async function handleSaveFaqs() {
    const updates = filteredFaqs.map((faq, idx) =>
      supabase
        .from('faq_items')
        .update({
          question: faq.question,
          answer: faq.answer,
          order_index: idx,
          updated_at: new Date().toISOString(),
        })
        .eq('id', faq.id)
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) {
      toast.error('FAQ 저장 실패');
    } else {
      toast.success('FAQ가 저장되었습니다');
    }
  }

  if (loading) return <LoadingSpinner size="md" />;

  return (
    <div className="admin-faq-shop-layout">
      <div className="admin-faq-categories">
        <div className="admin-card">
          <h3 className="admin-card-title">카테고리</h3>
          <div className="admin-page-actions">
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={handleSaveCatOrder}
            >
              <Save size={14} />
              순서 저장
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setShowAddCat(true)}
            >
              <Plus size={14} />
              추가
            </button>
          </div>
          {showAddCat && (
            <div className="admin-inline-form">
              <div className="admin-form-row">
                <input
                  className="admin-input"
                  placeholder="카테고리명"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                />
                <button type="button" className="admin-btn admin-btn-primary" onClick={handleAddCategory}>
                  추가
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={() => { setShowAddCat(false); setNewCatName(''); }}
                >
                  취소
                </button>
              </div>
            </div>
          )}
          <DragSortList
            items={categories}
            keyExtractor={(cat) => cat.id}
            onReorder={handleCatReorder}
            renderItem={(cat) => (
              <div className="admin-drag-item-content">
                {editingCatId === cat.id ? (
                  <div className="admin-form-row">
                    <input
                      className="admin-input"
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={() => handleCatSaveEdit(cat.id)}
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => setEditingCatId(null)}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`admin-faq-cat-btn ${selectedCategoryId === cat.id ? 'admin-faq-cat-btn-active' : ''}`}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      onDoubleClick={() => handleCatStartEdit(cat)}
                    >
                      {cat.name}
                      <span className="admin-faq-cat-count">
                        {faqItems.filter((item) => item.category_id === cat.id).length}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-icon admin-btn-danger"
                      onClick={() => setDeleteCatTarget(cat)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          />
        </div>
      </div>

      <div className="admin-faq-items">
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">
              {categories.find((c) => c.id === selectedCategoryId)?.name ?? 'FAQ'} 목록
            </h3>
            <div className="admin-page-actions">
              <button type="button" className="admin-btn admin-btn-primary" onClick={handleAddFaq}>
                <Plus size={16} />
                FAQ 추가
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={handleSaveFaqs}>
                <Save size={16} />
                저장
              </button>
            </div>
          </div>

          {filteredFaqs.length === 0 ? (
            <EmptyState
              title="FAQ가 없습니다"
              description="새 FAQ를 추가하세요"
              action={{ label: 'FAQ 추가', onClick: handleAddFaq }}
            />
          ) : (
            <div className="admin-faq-list">
              {filteredFaqs.map((faq) => (
                <div key={faq.id} className={`admin-faq-accordion-item${expandedFaqId === faq.id ? ' expanded' : ''}`}>
                  <button
                    type="button"
                    className="admin-faq-accordion-header"
                    onClick={() => setExpandedFaqId(expandedFaqId === faq.id ? null : faq.id)}
                  >
                    <span className="admin-faq-accordion-question">
                      {faq.question || '질문 없음'}
                    </span>
                    <span className="admin-faq-accordion-indicators">
                      {!faq.is_visible && <span className="admin-faq-hidden-badge">숨김</span>}
                      {expandedFaqId === faq.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>
                  <div className={`admin-faq-accordion-body${expandedFaqId === faq.id ? ' open' : ''}`}>
                    <div className="admin-faq-accordion-content">
                      <div className="admin-form-field">
                        <label className="admin-form-label">질문</label>
                        <input
                          className="admin-input"
                          value={faq.question}
                          onChange={(e) => handleFaqFieldChange(faq.id, 'question', e.target.value)}
                        />
                      </div>
                      <div className="admin-form-field">
                        <label className="admin-form-label">답변</label>
                        <textarea
                          className="admin-textarea"
                          value={faq.answer}
                          onChange={(e) => handleFaqFieldChange(faq.id, 'answer', e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="admin-faq-item-actions">
                        <Toggle
                          checked={faq.is_visible}
                          onChange={() => handleToggleFaqVisibility(faq)}
                          label="표시"
                        />
                        <button
                          type="button"
                          className="admin-btn admin-btn-icon admin-btn-danger"
                          onClick={() => setDeleteTarget(faq)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteCatTarget !== null}
        title="카테고리 삭제"
        message={`'${deleteCatTarget?.name}' 카테고리를 삭제하시겠습니까? 해당 카테고리의 FAQ도 함께 삭제됩니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDeleteCategory}
        onCancel={() => setDeleteCatTarget(null)}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="FAQ 삭제"
        message={`'${deleteTarget?.question}' FAQ를 삭제하시겠습니까?`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDeleteFaq}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function FaqPage() {
  const [activeTab, setActiveTab] = useState('landing');

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">FAQ 관리</h1>

      <TabNav tabs={FAQ_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="admin-card">
        {activeTab === 'landing' ? <LandingFaqTab /> : <ShopFaqTab />}
      </div>
    </div>
  );
}
