import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { Product, ProductCategory } from '../../../types/admin';
import type { Database } from '../../../types/database';
import { DataTable, SearchInput, Pagination, ConfirmModal, EmptyState, Toggle } from '../ui';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit, Copy } from 'lucide-react';

const PAGE_SIZE = 20;

type ProductWithCategory = Product & {
  product_categories: { name: string } | null;
};

export default function ProductListPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortColumn, setSortColumn] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('product_categories')
      .select('id, name, description, defaults, order_index, is_visible, is_seed, updated_at')
      .order('order_index');
    setCategories(data ?? []);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('products')
      .select('*, product_categories(name)', { count: 'exact' });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (categoryFilter) {
      query = query.eq('category_id', categoryFilter);
    }

    query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) {
      toast.error('제품 목록을 불러올 수 없습니다');
    } else {
      setProducts((data as ProductWithCategory[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, categoryFilter, sortColumn, sortDirection, page]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter]);

  const handleSort = useCallback((col: string, dir: 'asc' | 'desc') => {
    setSortColumn(col);
    setSortDirection(dir);
  }, []);

  const toggleVisibility = useCallback(async (product: ProductWithCategory) => {
    const { error } = await supabase
      .from('products')
      .update({ is_visible: !product.is_visible })
      .eq('id', product.id);
    if (error) {
      toast.error('변경에 실패했습니다');
    } else {
      toast.success(product.is_visible ? '숨김 처리됨' : '공개 처리됨');
      fetchProducts();
    }
  }, [fetchProducts]);

  const duplicateProduct = useCallback(async (product: Product) => {
    const newId = crypto.randomUUID();
    const insertData: Database['public']['Tables']['products']['Insert'] = {
      id: newId,
      name: `${product.name} (복사)`,
      slug: `${product.slug}-copy-${Date.now()}`,
      thumbnail: product.thumbnail,
      category_id: product.category_id,
      price: product.price,
      price_range: product.price_range,
      description: product.description,
      full_description: product.full_description,
      features: product.features,
      specs: product.specs,
      production_time: product.production_time,
      included_services: product.included_services,
      tags: product.tags,
      material_images: product.material_images,
      lighting_images: product.lighting_images,
      options: product.options,
      production_steps: product.production_steps,
      installation_gallery: product.installation_gallery,
      images: product.images,
      popularity: product.popularity,
      is_new: product.is_new,
      is_featured: product.is_featured,
      related_product_ids: product.related_product_ids,
      is_visible: product.is_visible,
      is_seed: false,
    };
    const { error } = await supabase
      .from('products')
      .insert(insertData);
    if (error) {
      toast.error('복제에 실패했습니다');
    } else {
      toast.success('제품이 복제되었습니다');
      fetchProducts();
    }
  }, [fetchProducts]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('제품이 삭제되었습니다');
      fetchProducts();
    }
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget, fetchProducts]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    {
      key: 'thumbnail',
      label: '이미지',
      width: '60px',
      render: (row: ProductWithCategory) => (
        <img src={row.thumbnail} alt={row.name} className="admin-table-thumbnail" />
      ),
    },
    { key: 'name', label: '제품명', sortable: true },
    {
      key: 'category',
      label: '카테고리',
      render: (row: ProductWithCategory) => row.product_categories?.name ?? '-',
    },
    { key: 'price', label: '가격' },
    {
      key: 'is_featured',
      label: '추천',
      render: (row: ProductWithCategory) =>
        row.is_featured ? <span className="admin-badge admin-badge-info">추천</span> : null,
    },
    {
      key: 'is_visible',
      label: '공개',
      render: (row: ProductWithCategory) => (
        <Toggle checked={row.is_visible} onChange={() => toggleVisibility(row)} />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '160px',
      render: (row: ProductWithCategory) => (
        <div className="admin-table-actions">
          <button type="button" className="admin-btn-icon" title="편집" onClick={(e) => { e.stopPropagation(); navigate(`/products/${row.id}`); }}>
            <Edit size={16} />
          </button>
          <button type="button" className="admin-btn-icon" title="복제" onClick={(e) => { e.stopPropagation(); duplicateProduct(row); }}>
            <Copy size={16} />
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
        <h1 className="admin-page-title">제품 관리</h1>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => navigate('/products/new')}>
          <Plus size={16} /> 제품 추가
        </button>
      </div>

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="제품명 검색..." />
        <select className="admin-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">전체 카테고리</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <select className="admin-select" value={sortColumn} onChange={(e) => { setSortColumn(e.target.value); setSortDirection('desc'); }}>
          <option value="created_at">최신순</option>
          <option value="name">이름순</option>
          <option value="popularity">인기순</option>
        </select>
      </div>

      {!loading && products.length === 0 ? (
        <EmptyState title="등록된 제품이 없습니다" description="새 제품을 추가해 보세요" action={{ label: '제품 추가', onClick: () => navigate('/products/new') }} />
      ) : (
        <DataTable columns={columns} data={products} loading={loading} sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onRowClick={(row) => navigate(`/products/${row.id}`)} />
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={PAGE_SIZE} totalItems={total} />

      <ConfirmModal isOpen={!!deleteTarget} title="제품 삭제" message={`"${deleteTarget?.name}" 제품을 삭제하시겠습니까?`} confirmLabel="삭제" cancelLabel="취소" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
