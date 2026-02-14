import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { BlogPost } from '../../../types/admin';
import { DataTable, SearchInput, Pagination, ConfirmModal, EmptyState, StatusBadge, Toggle } from '../ui';
import toast from 'react-hot-toast';
import { Plus, Trash2, Edit } from 'lucide-react';

const PAGE_SIZE = 20;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function BlogListPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortColumn, setSortColumn] = useState('published_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('blog_posts')
      .select('category');
    if (data) {
      const unique = Array.from(new Set(data.map((d) => d.category).filter((c): c is string => !!c)));
      setCategories(unique.sort());
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('blog_posts')
      .select('id, slug, title, description, content, category, tags, image_url, image_alt, author, is_published, published_at, is_seed, created_at, updated_at', { count: 'exact' });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (categoryFilter) {
      query = query.eq('category', categoryFilter);
    }
    if (statusFilter === 'published') {
      query = query.eq('is_published', true);
    } else if (statusFilter === 'draft') {
      query = query.eq('is_published', false);
    }

    query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
    const from = (page - 1) * PAGE_SIZE;
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) {
      toast.error('블로그 목록을 불러올 수 없습니다');
    } else {
      setPosts(data ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, categoryFilter, statusFilter, sortColumn, sortDirection, page]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const handleSort = useCallback((col: string, dir: 'asc' | 'desc') => {
    setSortColumn(col);
    setSortDirection(dir);
  }, []);

  const togglePublish = useCallback(async (post: BlogPost) => {
    const newPublished = !post.is_published;
    const { error } = await supabase
      .from('blog_posts')
      .update({
        is_published: newPublished,
        published_at: newPublished ? new Date().toISOString() : null,
      })
      .eq('id', post.id);
    if (error) {
      toast.error('변경에 실패했습니다');
    } else {
      toast.success(newPublished ? '게시됨' : '비공개 처리됨');
      fetchPosts();
    }
  }, [fetchPosts]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('블로그 포스트가 삭제되었습니다');
      fetchPosts();
    }
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget, fetchPosts]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const columns = [
    { key: 'title', label: '제목', sortable: true },
    {
      key: 'category',
      label: '카테고리',
      render: (row: BlogPost) => row.category ?? '-',
    },
    {
      key: 'is_published',
      label: '상태',
      render: (row: BlogPost) => (
        <StatusBadge
          status={row.is_published ? 'published' : 'draft'}
          variant={row.is_published ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'published_at',
      label: '게시일',
      sortable: true,
      render: (row: BlogPost) => formatDate(row.published_at),
    },
    {
      key: 'author',
      label: '작성자',
      render: (row: BlogPost) => row.author ?? '-',
    },
    {
      key: 'publish_toggle',
      label: '공개',
      render: (row: BlogPost) => (
        <Toggle checked={row.is_published} onChange={() => togglePublish(row)} />
      ),
    },
    {
      key: 'actions',
      label: '',
      width: '100px',
      render: (row: BlogPost) => (
        <div className="admin-table-actions">
          <button type="button" className="admin-btn-icon" title="편집" onClick={(e) => { e.stopPropagation(); navigate(`/blog/${row.id}`); }}>
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
        <h1 className="admin-page-title">블로그 관리</h1>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => navigate('/blog/new')}>
          <Plus size={16} /> 새 글 작성
        </button>
      </div>

      <div className="admin-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="제목 검색..." />
        <select className="admin-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">전체 카테고리</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">전체 상태</option>
          <option value="published">게시됨</option>
          <option value="draft">임시저장</option>
        </select>
        <select className="admin-select" value={sortColumn} onChange={(e) => { setSortColumn(e.target.value); setSortDirection('desc'); }}>
          <option value="published_at">게시일순</option>
          <option value="title">제목순</option>
        </select>
      </div>

      {!loading && posts.length === 0 ? (
        <EmptyState title="블로그 포스트가 없습니다" description="새 글을 작성해 보세요" action={{ label: '새 글 작성', onClick: () => navigate('/blog/new') }} />
      ) : (
        <DataTable columns={columns} data={posts} loading={loading} sortColumn={sortColumn} sortDirection={sortDirection} onSort={handleSort} onRowClick={(row) => navigate(`/blog/${row.id}`)} />
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} pageSize={PAGE_SIZE} totalItems={total} />

      <ConfirmModal isOpen={!!deleteTarget} title="블로그 삭제" message={`"${deleteTarget?.title}" 포스트를 삭제하시겠습니까?`} confirmLabel="삭제" cancelLabel="취소" variant="danger" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
