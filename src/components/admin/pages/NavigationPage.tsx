import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { NavigationItem } from '../../../types/admin';
import type { Database } from '../../../types/database';
import { TabNav, DragSortList, Toggle, ConfirmModal, LoadingSpinner, EmptyState } from '../ui';
import { Plus, Trash2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const NAV_TABS = [
  { key: 'header', label: '헤더 메뉴' },
  { key: 'shop_header', label: '쇼핑몰 헤더' },
  { key: 'footer', label: '푸터 링크' },
];

export default function NavigationPage() {
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('header');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editHref, setEditHref] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<NavigationItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('navigation_items')
      .select('*')
      .order('order_index');
    if (error) {
      toast.error('네비게이션 로드 실패');
      setLoading(false);
      return;
    }
    setItems((data ?? []) as NavigationItem[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = items.filter((item) => item.nav_type === activeTab);

  function handleStartEdit(item: NavigationItem) {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditHref(item.href);
  }

  async function handleSaveEdit(id: string) {
    const { error } = await supabase
      .from('navigation_items')
      .update({ label: editLabel, href: editHref, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('수정 실패');
      return;
    }

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label: editLabel, href: editHref } : item))
    );
    setEditingId(null);
    toast.success('항목이 수정되었습니다');
  }

  async function handleAdd() {
    const maxOrder = filteredItems.length > 0
      ? Math.max(...filteredItems.map((i) => i.order_index)) + 1
      : 0;

    const insertData: Database['public']['Tables']['navigation_items']['Insert'] = {
      nav_type: activeTab,
      label: '새 항목',
      href: '/',
      order_index: maxOrder,
    };
    const { error } = await supabase.from('navigation_items').insert(insertData);

    if (error) {
      toast.error('추가 실패');
      return;
    }

    toast.success('항목이 추가되었습니다');
    fetchData();
  }

  async function handleToggleVisibility(item: NavigationItem) {
    const { error } = await supabase
      .from('navigation_items')
      .update({ is_visible: !item.is_visible, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      toast.error('변경 실패');
      return;
    }

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_visible: !item.is_visible } : i))
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    const { error } = await supabase.from('navigation_items').delete().eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제 실패');
      setDeleteTarget(null);
      return;
    }

    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('항목이 삭제되었습니다');
  }

  function handleReorder(reordered: NavigationItem[]) {
    const otherItems = items.filter((item) => item.nav_type !== activeTab);
    setItems([...otherItems, ...reordered]);
  }

  async function handleSaveOrder() {
    setSaving(true);
    const updates = filteredItems.map((item, idx) =>
      supabase
        .from('navigation_items')
        .update({ order_index: idx, updated_at: new Date().toISOString() })
        .eq('id', item.id)
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
        <h1 className="admin-page-title">네비게이션 관리</h1>
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
        </div>
      </div>

      <TabNav tabs={NAV_TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="admin-card">
        <div className="admin-card-header">
          <button type="button" className="admin-btn admin-btn-primary" onClick={handleAdd}>
            <Plus size={16} />
            항목 추가
          </button>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            title="항목이 없습니다"
            description="새 네비게이션 항목을 추가하세요"
            action={{ label: '항목 추가', onClick: handleAdd }}
          />
        ) : (
          <DragSortList
            items={filteredItems}
            keyExtractor={(item) => item.id}
            onReorder={handleReorder}
            renderItem={(item) => (
              <div className="admin-drag-item-content">
                {editingId === item.id ? (
                  <div className="admin-form-row">
                    <input
                      className="admin-input"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="라벨"
                    />
                    <input
                      className="admin-input"
                      value={editHref}
                      onChange={(e) => setEditHref(e.target.value)}
                      placeholder="URL"
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      onClick={() => handleSaveEdit(item.id)}
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
                      onClick={() => handleStartEdit(item)}
                    >
                      <span className="admin-drag-item-name">{item.label}</span>
                      <span className="admin-drag-item-desc">{item.href}</span>
                    </button>
                    <Toggle
                      checked={item.is_visible}
                      onChange={() => handleToggleVisibility(item)}
                      label="표시"
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-icon admin-btn-danger"
                      onClick={() => setDeleteTarget(item)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          />
        )}
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="항목 삭제"
        message={`'${deleteTarget?.label}' 항목을 삭제하시겠습니까?`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
