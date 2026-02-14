import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { BlogPost } from '../../../types/admin';
import { FormField, Toggle, TagInput, LoadingSpinner, ConfirmModal, ImageUploader } from '../ui';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

interface BlogForm {
  title: string;
  slug: string;
  category: string;
  tags: string[];
  description: string;
  content: string;
  image_url: string;
  image_alt: string;
  author: string;
  is_published: boolean;
  published_at: string;
}

function generateSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'post-' + Date.now()
  );
}

function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseTags(raw: BlogPost['tags']): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === 'string');
  }
  return [];
}

function createEmptyForm(): BlogForm {
  return {
    title: '',
    slug: '',
    category: '',
    tags: [],
    description: '',
    content: '',
    image_url: '',
    image_alt: '',
    author: '엠디자인',
    is_published: false,
    published_at: '',
  };
}

function postToForm(post: BlogPost): BlogForm {
  return {
    title: post.title,
    slug: post.slug,
    category: post.category ?? '',
    tags: parseTags(post.tags),
    description: post.description ?? '',
    content: post.content,
    image_url: post.image_url ?? '',
    image_alt: post.image_alt ?? '',
    author: post.author,
    is_published: post.is_published,
    published_at: toDateTimeLocal(post.published_at),
  };
}

export default function BlogEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';

  const [form, setForm] = useState<BlogForm>(createEmptyForm);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  const updateField = useCallback(<K extends keyof BlogForm>(key: K, value: BlogForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('blog_posts').select('category');
      if (data) {
        const unique = Array.from(new Set(data.map((d) => d.category).filter((c): c is string => !!c)));
        setExistingCategories(unique.sort());
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    async function loadPost() {
      setLoading(true);
      const postId = id!;
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, slug, title, description, content, category, tags, image_url, image_alt, author, is_published, published_at, is_seed, created_at, updated_at')
        .eq('id', postId)
        .single();
      if (error || !data) {
        toast.error('블로그 포스트를 불러올 수 없습니다');
        navigate('/blog');
        return;
      }
      setForm(postToForm(data));
      setSlugManual(true);
      setLoading(false);
    }
    loadPost();
  }, [id, isNew, navigate]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setForm((prev) => ({
        ...prev,
        title: value,
        slug: slugManual ? prev.slug : generateSlug(value),
      }));
    },
    [slugManual],
  );

  const handleSlugChange = useCallback((value: string) => {
    setSlugManual(true);
    updateField('slug', value);
  }, [updateField]);

  const handlePublishToggle = useCallback((checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      is_published: checked,
      published_at: checked && !prev.published_at
        ? toDateTimeLocal(new Date().toISOString())
        : prev.published_at,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      toast.error('제목을 입력해 주세요');
      return;
    }
    if (!form.slug.trim()) {
      toast.error('슬러그를 입력해 주세요');
      return;
    }
    setSaving(true);

    const payload = {
      title: form.title,
      slug: form.slug,
      category: form.category || null,
      tags: form.tags,
      description: form.description || null,
      content: form.content,
      image_url: form.image_url || null,
      image_alt: form.image_alt || null,
      author: form.author || '엠디자인',
      is_published: form.is_published,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
    };

    if (isNew) {
      const newId = crypto.randomUUID();
      const { error } = await supabase
        .from('blog_posts')
        .insert({ ...payload, id: newId, is_seed: false });
      if (error) {
        toast.error('저장에 실패했습니다');
      } else {
        toast.success('블로그 포스트가 생성되었습니다');
        navigate(`/blog/${newId}`);
      }
    } else {
      const { error } = await supabase
        .from('blog_posts')
        .update(payload)
        .eq('id', id!);
      if (error) {
        toast.error('저장에 실패했습니다');
      } else {
        toast.success('저장되었습니다');
      }
    }
    setSaving(false);
  }, [form, isNew, id, navigate]);

  const handleDelete = useCallback(async () => {
    if (!id || isNew) return;
    setDeleting(true);
    const { error } = await supabase.from('blog_posts').delete().eq('id', id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('블로그 포스트가 삭제되었습니다');
      navigate('/blog');
    }
    setDeleting(false);
    setShowDelete(false);
  }, [id, isNew, navigate]);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => navigate('/blog')}>
            <ArrowLeft size={16} /> 목록
          </button>
          <h1 className="admin-page-title">{isNew ? '블로그 글 작성' : '블로그 글 편집'}</h1>
        </div>
        <div className="admin-page-header-actions">
          {!isNew && (
            <button type="button" className="admin-btn admin-btn-danger" onClick={() => setShowDelete(true)}>
              <Trash2 size={16} /> 삭제
            </button>
          )}
          <button type="button" className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-form-grid">
          <FormField label="제목" required htmlFor="title">
            <input id="title" className="admin-input" value={form.title} onChange={(e) => handleTitleChange(e.target.value)} />
          </FormField>

          <FormField label="슬러그" required htmlFor="slug" description="URL에 사용되는 고유 식별자">
            <input id="slug" className="admin-input" value={form.slug} onChange={(e) => handleSlugChange(e.target.value)} />
          </FormField>

          <FormField label="카테고리" htmlFor="category">
            <input
              id="category"
              className="admin-input"
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              list="category-list"
              placeholder="카테고리 입력 또는 선택"
            />
            <datalist id="category-list">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </FormField>

          <FormField label="태그">
            <TagInput tags={form.tags} onChange={(tags) => updateField('tags', tags)} placeholder="태그 입력 후 Enter" />
          </FormField>

          <FormField label="요약 설명" htmlFor="description">
            <textarea id="description" className="admin-textarea" value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} placeholder="포스트의 짧은 요약" />
          </FormField>

          <FormField label="본문 (마크다운)" htmlFor="content">
            <textarea
              id="content"
              className="admin-textarea"
              value={form.content}
              onChange={(e) => updateField('content', e.target.value)}
              rows={20}
              style={{ fontFamily: 'monospace' }}
              placeholder="마크다운 형식으로 작성하세요"
            />
          </FormField>

          <FormField label="대표 이미지">
            <ImageUploader value={form.image_url} onChange={(url) => updateField('image_url', url)} folder="blog" />
          </FormField>

          <FormField label="이미지 대체 텍스트" htmlFor="image_alt">
            <input id="image_alt" className="admin-input" value={form.image_alt} onChange={(e) => updateField('image_alt', e.target.value)} placeholder="이미지 설명" />
          </FormField>

          <FormField label="작성자" htmlFor="author">
            <input id="author" className="admin-input" value={form.author} onChange={(e) => updateField('author', e.target.value)} />
          </FormField>

          <FormField label="게시일" htmlFor="published_at">
            <input id="published_at" type="datetime-local" className="admin-input" value={form.published_at} onChange={(e) => updateField('published_at', e.target.value)} />
          </FormField>

          <Toggle checked={form.is_published} onChange={handlePublishToggle} label="게시 상태" />
        </div>
      </div>

      <ConfirmModal isOpen={showDelete} title="블로그 삭제" message="이 포스트를 삭제하시겠습니까?" confirmLabel="삭제" cancelLabel="취소" variant="danger" onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={deleting} />
    </div>
  );
}
