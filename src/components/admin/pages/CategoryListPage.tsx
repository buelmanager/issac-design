import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { ProductCategory } from '../../../types/admin';
import type { Database } from '../../../types/database';
import { DragSortList, Toggle, ConfirmModal, LoadingSpinner, EmptyState } from '../ui';
import { Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface CategoryWithCount extends ProductCategory {
  product_count: number;
}

export default function CategoryListPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: cats, error } = await supabase
      .from('product_categories')
      .select('*')
      .order('order_index');

    if (error) {
      toast.error('카테고리 로드 실패');
      setLoading(false);
      return;
    }

    const list = (cats ?? []) as ProductCategory[];
    const withCounts: CategoryWithCount[] = await Promise.all(
      list.map(async (cat) => {
        const { count } = await supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', cat.id);
        return { ...cat, product_count: count ?? 0 };
      })
    );

    setCategories(withCounts);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleStartEdit(cat: CategoryWithCount) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDescription(cat.description ?? '');
  }

  async function handleSaveEdit(id: string) {
    const { error } = await supabase
      .from('product_categories')
      .update({ name: editName, description: editDescription || null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('수정 실패');
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: editName, description: editDescription || null } : c))
    );
    setEditingId(null);
    toast.success('카테고리가 수정되었습니다');
  }

  async function handleAdd() {
    if (!newName.trim()) {
      toast.error('카테고리명을 입력하세요');
      return;
    }

    const newId = `cat_${Date.now()}`;
    const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.order_index)) + 1 : 0;

    const insertData: Database['public']['Tables']['product_categories']['Insert'] = {
      id: newId,
      name: newName.trim(),
      description: newDescription.trim() || null,
      order_index: maxOrder,
    };
    const { error } = await supabase.from('product_categories').insert(insertData);

    if (error) {
      toast.error('추가 실패');
      return;
    }

    setNewName('');
    setNewDescription('');
    setShowAddForm(false);
    toast.success('카테고리가 추가되었습니다');
    fetchData();
  }

  async function handleToggleVisibility(cat: CategoryWithCount) {
    const { error } = await supabase
      .from('product_categories')
      .update({ is_visible: !cat.is_visible, updated_at: new Date().toISOString() })
      .eq('id', cat.id);

    if (error) {
      toast.error('변경 실패');
      return;
    }

    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_visible: !cat.is_visible } : c))
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    const { error } = await supabase.from('product_categories').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제 실패');
      setDeleteTarget(null);
      return;
    }

    setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('카테고리가 삭제되었습니다');
  }

  function handleReorder(reordered: CategoryWithCount[]) {
    setCategories(reordered);
  }

  async function handleSaveOrder() {
    setSaving(true);
    const updates = categories.map((cat, idx) =>
      supabase.from('product_categories').update({ order_index: idx }).eq('id', cat.id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      toast.error('순서 저장 실패');
    } else {
      toast.success('순서가 저장되었습니다');
    }
    setSaving(false);
  }

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">제품 카테고리</h1>
        <div className="admin-page-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSaveOrder}
            disabled={saving}
          >
            <Save size={16} />
            {saving ? '저장 중...' : '순서 저장'}
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} />
            카테고리 추가
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="admin-card admin-inline-form">
          <div className="admin-form-row">
            <input
              className="admin-input"
              placeholder="카테고리명"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="admin-input"
              placeholder="설명 (선택)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <button type="button" className="admin-btn admin-btn-primary" onClick={handleAdd}>
              추가
            </button>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => setShowAddForm(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState
          title="카테고리가 없습니다"
          description="새 카테고리를 추가하세요"
          action={{ label: '카테고리 추가', onClick: () => setShowAddForm(true) }}
        />
      ) : (
        <div className="admin-card">
          <DragSortList
            items={categories}
            keyExtractor={(cat) => cat.id}
            onReorder={handleReorder}
            renderItem={(cat) => (
              <div className="admin-drag-item-content">
                {editingId === cat.id ? (
                  <div className="admin-form-row">
                    <input
                      className="admin-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <input
                      className="admin-input"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="설명"
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={() => handleSaveEdit(cat.id)}
                    >
                      <Save size={14} />
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-secondary"
                      onClick={() => setEditingId(null)}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="admin-inline-edit-trigger"
                      onClick={() => handleStartEdit(cat)}
                    >
                      <span className="admin-drag-item-name">{cat.name}</span>
                      {cat.description && (
                        <span className="admin-drag-item-desc">{cat.description}</span>
                      )}
                    </button>
                    <span className="admin-badge admin-badge-default">
                      {cat.product_count}개 제품
                    </span>
                    <Toggle
                      checked={cat.is_visible}
                      onChange={() => handleToggleVisibility(cat)}
                      label="표시"
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-icon admin-btn-danger"
                      onClick={() => setDeleteTarget(cat)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          />
        </div>
      )}

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="카테고리 삭제"
        message={`'${deleteTarget?.name}' 카테고리를 삭제하시겠습니까?`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
