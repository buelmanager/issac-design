import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { PortfolioItem } from '../../../types/admin';
import { FormField, Toggle, LoadingSpinner, ConfirmModal, ImageUploader } from '../ui';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

const CATEGORIES = ['채널간판', '돌출간판', '입체간판', 'LED간판', '네온사인', '기타'];

interface PortfolioForm {
  title: string;
  category: string;
  description: string;
  client_name: string;
  location: string;
  completed_date: string;
  image_before: string;
  image_after: string;
  image_process: string;
  product_used: string;
  testimonial: string;
  is_visible: boolean;
}

function createEmptyForm(): PortfolioForm {
  return {
    title: '',
    category: CATEGORIES[0],
    description: '',
    client_name: '',
    location: '',
    completed_date: '',
    image_before: '',
    image_after: '',
    image_process: '',
    product_used: '',
    testimonial: '',
    is_visible: true,
  };
}

function itemToForm(item: PortfolioItem): PortfolioForm {
  return {
    title: item.title,
    category: item.category,
    description: item.description ?? '',
    client_name: item.client_name ?? '',
    location: item.location ?? '',
    completed_date: item.completed_date ?? '',
    image_before: item.image_before ?? '',
    image_after: item.image_after ?? '',
    image_process: item.image_process ?? '',
    product_used: item.product_used ?? '',
    testimonial: item.testimonial ?? '',
    is_visible: item.is_visible,
  };
}

export default function PortfolioEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';

  const [form, setForm] = useState<PortfolioForm>(createEmptyForm);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateField = useCallback(<K extends keyof PortfolioForm>(key: K, value: PortfolioForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    async function loadProducts() {
      const { data } = await supabase.from('products').select('id, name').order('name');
      setProducts(data ?? []);
    }
    loadProducts();
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    async function loadItem() {
      setLoading(true);
      const itemId = id!;
      const { data, error } = await supabase
        .from('portfolio_items')
        .select('id, title, category, description, client_name, location, completed_date, image_before, image_after, image_process, product_used, testimonial, is_visible, order_index, is_seed, updated_at')
        .eq('id', itemId)
        .single();
      if (error || !data) {
        toast.error('포트폴리오를 불러올 수 없습니다');
        navigate('/portfolio');
        return;
      }
      setForm(itemToForm(data));
      setLoading(false);
    }
    loadItem();
  }, [id, isNew, navigate]);

  const handleSave = useCallback(async () => {
    if (!form.title.trim()) {
      toast.error('제목을 입력해 주세요');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      category: form.category,
      description: form.description || null,
      client_name: form.client_name || null,
      location: form.location || null,
      completed_date: form.completed_date || null,
      image_before: form.image_before || null,
      image_after: form.image_after || null,
      image_process: form.image_process || null,
      product_used: form.product_used || null,
      testimonial: form.testimonial || null,
      is_visible: form.is_visible,
    };

    if (isNew) {
      const newId = crypto.randomUUID();
      const { error } = await supabase
        .from('portfolio_items')
        .insert({ ...payload, id: newId, order_index: 0, is_seed: false });
      if (error) {
        toast.error('저장에 실패했습니다');
      } else {
        toast.success('포트폴리오가 생성되었습니다');
        navigate(`/portfolio/${newId}`);
      }
    } else {
      const { error } = await supabase
        .from('portfolio_items')
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
    const { error } = await supabase.from('portfolio_items').delete().eq('id', id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('포트폴리오가 삭제되었습니다');
      navigate('/portfolio');
    }
    setDeleting(false);
    setShowDelete(false);
  }, [id, isNew, navigate]);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => navigate('/portfolio')}>
            <ArrowLeft size={16} /> 목록
          </button>
          <h1 className="admin-page-title">{isNew ? '포트폴리오 추가' : '포트폴리오 편집'}</h1>
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
            <input id="title" className="admin-input" value={form.title} onChange={(e) => updateField('title', e.target.value)} />
          </FormField>
          <FormField label="카테고리" htmlFor="category">
            <select id="category" className="admin-select" value={form.category} onChange={(e) => updateField('category', e.target.value)}>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </FormField>
          <FormField label="설명" htmlFor="description">
            <textarea id="description" className="admin-textarea" value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={4} />
          </FormField>
          <FormField label="고객명" htmlFor="client_name">
            <input id="client_name" className="admin-input" value={form.client_name} onChange={(e) => updateField('client_name', e.target.value)} />
          </FormField>
          <FormField label="위치" htmlFor="location">
            <input id="location" className="admin-input" value={form.location} onChange={(e) => updateField('location', e.target.value)} />
          </FormField>
          <FormField label="완료일" htmlFor="completed_date">
            <input id="completed_date" type="date" className="admin-input" value={form.completed_date} onChange={(e) => updateField('completed_date', e.target.value)} />
          </FormField>
          <FormField label="Before 이미지">
            <ImageUploader value={form.image_before} onChange={(url) => updateField('image_before', url)} folder="portfolio" />
          </FormField>
          <FormField label="After 이미지">
            <ImageUploader value={form.image_after} onChange={(url) => updateField('image_after', url)} folder="portfolio" />
          </FormField>
          <FormField label="과정 이미지">
            <ImageUploader value={form.image_process} onChange={(url) => updateField('image_process', url)} folder="portfolio" />
          </FormField>
          <FormField label="사용 제품" htmlFor="product_used">
            <select id="product_used" className="admin-select" value={form.product_used} onChange={(e) => updateField('product_used', e.target.value)}>
              <option value="">선택 안함</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="고객 후기" htmlFor="testimonial">
            <textarea id="testimonial" className="admin-textarea" value={form.testimonial} onChange={(e) => updateField('testimonial', e.target.value)} rows={4} />
          </FormField>
          <Toggle checked={form.is_visible} onChange={(v) => updateField('is_visible', v)} label="공개" />
        </div>
      </div>

      <ConfirmModal isOpen={showDelete} title="포트폴리오 삭제" message="이 항목을 삭제하시겠습니까?" confirmLabel="삭제" cancelLabel="취소" variant="danger" onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={deleting} />
    </div>
  );
}
