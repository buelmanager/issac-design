import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { PortfolioItem } from '../../../types/admin';
import { DataTable, SearchInput, Pagination, ConfirmModal, EmptyState, Toggle } from '../ui';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit } from 'lucide-react';

const PAGE_SIZE = 20;
const CATEGORIES = ['전체', '채널간판', '돌출간판', '입체간판', 'LED간판', '네온사인', '기타'];

export default function PortfolioListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('portfolio_items')
      .select('id, title, category, description, client_name, location, completed_date, image_before, image_after, image_process, product_used, testimonial, is_visible, order_index, is_seed, updated_at', { count: 'exact' });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }

    query = query.order('order_index', { ascending: true });
    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) {
      toast.error('포트폴리오를 불러올 수 없습니다');
    } else {
      setItems(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, categoryFilter, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const toggleVisibility = useCallback(async (item: PortfolioItem) => {
    const { error } = await supabase
      .from('portfolio_items')
      .update({ is_visible: !item.is_visible })
      .eq('id', item.id);
    if (error) {
      toast.error('변경에 실패했습니다');
    } else {
      toast.success(item.is_visible ? '숨김 처리됨' : '공개 처리됨');
      fetchItems();
    }
  }, [fetchItems]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('portfolio_items')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('삭제되었습니다');
      fetchItems();
    }
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget, fetchItems]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    { key: 'title', label: '제목' },
    { key: 'category', label: '카테고리' },
    { key: 'client_name', label: '고객명', render: (row: PortfolioItem) => row.client_name ?? '-' },
    { key: 'completed_date', label: '완료일', render: (row: PortfolioItem) => row.completed_date ?? '-' },
    {
      key: 'is_visible',
      label: '공개',
      render: (row: PortfolioItem) => (
        <Toggle checked={row.is_visible} onChange={() => toggleVisibility(row)} />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (row: PortfolioItem) => (
        <div className="admin-table-actions">
          <button type="button" className="admin-btn-icon" title="편집" onClick={(e) => { e.stopPropagation(); navigate(`/portfolio/${row.id}`); }}>
            <Edit size={16} />
          </button>
          <button type="button" className="admin-btn-icon admin-btn-icon-danger" title="삭제" onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}>
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">포트폴리오 관리</h1>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => navigate('/portfolio/new')}>
          <Plus size={16} /> 포트폴리오 추가
        </button>
      </div>

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="제목 검색..." />
        <select className="admin-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat === '전체' ? '' : cat}>{cat}</option>
          ))}
        </select>
      </div>

      {!loading && items.length === 0 ? (
        <EmptyState title="등록된 포트폴리오가 없습니다" description="새 포트폴리오를 추가해 보세요" action={{ label: '포트폴리오 추가', onClick: () => navigate('/portfolio/new') }} />
      ) : (
        <DataTable columns={columns} data={items} loading={loading} onRowClick={(row) => navigate(`/portfolio/${row.id}`)} />
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={PAGE_SIZE} totalItems={total} />

      <ConfirmModal isOpen={!!deleteTarget} title="포트폴리오 삭제" message={`"${deleteTarget?.title}" 항목을 삭제하시겠습니까?`} confirmLabel="삭제" cancelLabel="취소" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
