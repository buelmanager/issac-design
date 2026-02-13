import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Product, ProductCategory } from '../../../types/admin';
import type { Json } from '../../../types/database';
import { FormField, Toggle, TabNav, TagInput, LoadingSpinner, ConfirmModal } from '../ui';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

const TABS = [
  { key: 'basic', label: '기본 정보' },
  { key: 'images', label: '이미지' },
  { key: 'options', label: '옵션' },
  { key: 'production', label: '제작' },
  { key: 'gallery', label: '시공 갤러리' },
  { key: 'related', label: '연관 상품' },
];

interface ProductForm {
  name: string;
  slug: string;
  category_id: string;
  price: string;
  price_range: string;
  description: string;
  full_description: string;
  tags: string[];
  is_visible: boolean;
  is_featured: boolean;
  is_new: boolean;
  popularity: number;
  thumbnail: string;
  images: string;
  material_images: string;
  lighting_images: string;
  options: string;
  production_time: string;
  included_services: string[];
  features: string[];
  specs: string;
  installation_gallery: string;
  related_product_ids: string[];
}

function safeJsonParse(val: string, fallback: Json): Json {
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function safeJsonStringify(val: Json): string {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return '{}';
  }
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function createEmptyForm(): ProductForm {
  return {
    name: '',
    slug: '',
    category_id: '',
    price: '',
    price_range: '',
    description: '',
    full_description: '',
    tags: [],
    is_visible: true,
    is_featured: false,
    is_new: false,
    popularity: 0,
    thumbnail: '',
    images: '[]',
    material_images: '{}',
    lighting_images: '{}',
    options: '{}',
    production_time: '',
    included_services: [],
    features: [],
    specs: '{}',
    installation_gallery: '[]',
    related_product_ids: [],
  };
}

function productToForm(p: Product): ProductForm {
  return {
    name: p.name,
    slug: p.slug,
    category_id: p.category_id ?? '',
    price: p.price,
    price_range: p.price_range ?? '',
    description: p.description ?? '',
    full_description: p.full_description ?? '',
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    is_visible: p.is_visible,
    is_featured: p.is_featured,
    is_new: p.is_new,
    popularity: p.popularity,
    thumbnail: p.thumbnail,
    images: safeJsonStringify(p.images),
    material_images: safeJsonStringify(p.material_images),
    lighting_images: safeJsonStringify(p.lighting_images),
    options: safeJsonStringify(p.options),
    production_time: p.production_time ?? '',
    included_services: Array.isArray(p.included_services) ? (p.included_services as string[]) : [],
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
    specs: safeJsonStringify(p.specs),
    installation_gallery: safeJsonStringify(p.installation_gallery),
    related_product_ids: Array.isArray(p.related_product_ids) ? (p.related_product_ids as string[]) : [],
  };
}

export default function ProductEditPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';

  const [form, setForm] = useState<ProductForm>(createEmptyForm);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const updateField = useCallback(<K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase
        .from('product_categories')
        .select('id, name, description, order_index, is_visible, is_seed, updated_at')
        .order('order_index');
      setCategories(data ?? []);
    }
    async function loadProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, name')
        .order('name');
      setAllProducts(data ?? []);
    }
    loadCategories();
    loadProducts();
  }, []);

  useEffect(() => {
    if (isNew || !id) return;
    async function loadProduct() {
      setLoading(true);
      const productId = id!;
      const { data, error } = await supabase
        .from('products')
        .select('id, slug, name, category_id, price, price_range, thumbnail, images, description, full_description, features, specs, production_time, included_services, tags, material_images, lighting_images, options, production_steps, installation_gallery, popularity, is_new, is_featured, related_product_ids, is_visible, is_seed, created_at, updated_at')
        .eq('id', productId)
        .single();
      if (error || !data) {
        toast.error('제품을 불러올 수 없습니다');
        navigate('/products');
        return;
      }
      setForm(productToForm(data));
      setLoading(false);
    }
    loadProduct();
  }, [id, isNew, navigate]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('제품명을 입력해 주세요');
      return;
    }
    setSaving(true);
    const slug = form.slug || toSlug(form.name) || `product-${Date.now()}`;
    const payload = {
      name: form.name,
      slug,
      category_id: form.category_id || null,
      price: form.price,
      price_range: form.price_range || null,
      description: form.description || null,
      full_description: form.full_description || null,
      tags: form.tags as Json,
      is_visible: form.is_visible,
      is_featured: form.is_featured,
      is_new: form.is_new,
      popularity: form.popularity,
      thumbnail: form.thumbnail,
      images: safeJsonParse(form.images, []),
      material_images: safeJsonParse(form.material_images, {}),
      lighting_images: safeJsonParse(form.lighting_images, {}),
      options: safeJsonParse(form.options, {}),
      production_time: form.production_time || null,
      included_services: form.included_services as Json,
      features: form.features as Json,
      specs: safeJsonParse(form.specs, {}),
      installation_gallery: safeJsonParse(form.installation_gallery, []),
      related_product_ids: form.related_product_ids as Json,
    };

    if (isNew) {
      const newId = crypto.randomUUID();
      const { error } = await supabase
        .from('products')
        .insert({ ...payload, id: newId, is_seed: false });
      if (error) {
        toast.error('저장에 실패했습니다');
      } else {
        toast.success('제품이 생성되었습니다');
        navigate(`/products/${newId}`);
      }
    } else {
      const { error } = await supabase
        .from('products')
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
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error('삭제에 실패했습니다');
    } else {
      toast.success('제품이 삭제되었습니다');
      navigate('/products');
    }
    setDeleting(false);
    setShowDelete(false);
  }, [id, isNew, navigate]);

  const handleNameChange = useCallback((val: string) => {
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: prev.slug === '' || prev.slug === toSlug(prev.name) ? toSlug(val) : prev.slug,
    }));
  }, []);

  const handleRelatedToggle = useCallback((productId: string) => {
    setForm((prev) => {
      const ids = prev.related_product_ids.includes(productId)
        ? prev.related_product_ids.filter((pid) => pid !== productId)
        : [...prev.related_product_ids, productId];
      return { ...prev, related_product_ids: ids };
    });
  }, []);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-header-left">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => navigate('/products')}>
            <ArrowLeft size={16} /> 목록
          </button>
          <h1 className="admin-page-title">{isNew ? '제품 추가' : '제품 편집'}</h1>
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

      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="admin-card">
        {activeTab === 'basic' && (
          <div className="admin-form-grid">
            <FormField label="제품명" required htmlFor="name">
              <input id="name" className="admin-input" value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
            </FormField>
            <FormField label="슬러그" htmlFor="slug">
              <input id="slug" className="admin-input" value={form.slug} onChange={(e) => updateField('slug', e.target.value)} />
            </FormField>
            <FormField label="카테고리" htmlFor="category_id">
              <select id="category_id" className="admin-select" value={form.category_id} onChange={(e) => updateField('category_id', e.target.value)}>
                <option value="">선택 안함</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="가격" htmlFor="price">
              <input id="price" className="admin-input" value={form.price} onChange={(e) => updateField('price', e.target.value)} />
            </FormField>
            <FormField label="가격 범위" htmlFor="price_range">
              <input id="price_range" className="admin-input" value={form.price_range} onChange={(e) => updateField('price_range', e.target.value)} />
            </FormField>
            <FormField label="간단 설명" htmlFor="description">
              <textarea id="description" className="admin-textarea" value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} />
            </FormField>
            <FormField label="상세 설명" htmlFor="full_description">
              <textarea id="full_description" className="admin-textarea" value={form.full_description} onChange={(e) => updateField('full_description', e.target.value)} rows={6} />
            </FormField>
            <FormField label="태그">
              <TagInput tags={form.tags} onChange={(tags) => updateField('tags', tags)} placeholder="태그 입력..." />
            </FormField>
            <FormField label="인기도" htmlFor="popularity">
              <input id="popularity" type="number" className="admin-input" value={form.popularity} onChange={(e) => updateField('popularity', Number(e.target.value))} />
            </FormField>
            <div className="admin-toggle-group">
              <Toggle checked={form.is_visible} onChange={(v) => updateField('is_visible', v)} label="공개" />
              <Toggle checked={form.is_featured} onChange={(v) => updateField('is_featured', v)} label="추천" />
              <Toggle checked={form.is_new} onChange={(v) => updateField('is_new', v)} label="신제품" />
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="admin-form-grid">
            <FormField label="썸네일 URL" htmlFor="thumbnail">
              <input id="thumbnail" className="admin-input" value={form.thumbnail} onChange={(e) => updateField('thumbnail', e.target.value)} />
            </FormField>
            {form.thumbnail && <img src={form.thumbnail} alt="미리보기" className="admin-image-preview" />}
            <FormField label="이미지 목록 (JSON)" htmlFor="images" description="JSON 배열 형식 (예: [&quot;url1&quot;, &quot;url2&quot;])">
              <textarea id="images" className="admin-textarea admin-textarea-code" value={form.images} onChange={(e) => updateField('images', e.target.value)} rows={6} />
            </FormField>
            <FormField label="소재 이미지 (JSON)" htmlFor="material_images" description="키-값 쌍 (예: {&quot;wood&quot;: &quot;url&quot;})">
              <textarea id="material_images" className="admin-textarea admin-textarea-code" value={form.material_images} onChange={(e) => updateField('material_images', e.target.value)} rows={6} />
            </FormField>
            <FormField label="조명 이미지 (JSON)" htmlFor="lighting_images" description="off/on URL (예: {&quot;off&quot;: &quot;url&quot;, &quot;on&quot;: &quot;url&quot;})">
              <textarea id="lighting_images" className="admin-textarea admin-textarea-code" value={form.lighting_images} onChange={(e) => updateField('lighting_images', e.target.value)} rows={4} />
            </FormField>
          </div>
        )}

        {activeTab === 'options' && (
          <div className="admin-form-grid">
            <FormField label="옵션 데이터 (JSON)" htmlFor="options" description="sizes, materials, finishes, lightingTypes 등을 포함하는 JSON 객체">
              <textarea id="options" className="admin-textarea admin-textarea-code" value={form.options} onChange={(e) => updateField('options', e.target.value)} rows={16} />
            </FormField>
          </div>
        )}

        {activeTab === 'production' && (
          <div className="admin-form-grid">
            <FormField label="제작 기간" htmlFor="production_time">
              <input id="production_time" className="admin-input" value={form.production_time} onChange={(e) => updateField('production_time', e.target.value)} />
            </FormField>
            <FormField label="포함 서비스">
              <TagInput tags={form.included_services} onChange={(v) => updateField('included_services', v)} placeholder="서비스 입력..." />
            </FormField>
            <FormField label="특징">
              <TagInput tags={form.features} onChange={(v) => updateField('features', v)} placeholder="특징 입력..." />
            </FormField>
            <FormField label="스펙 (JSON)" htmlFor="specs" description="키-값 쌍 (예: {&quot;무게&quot;: &quot;5kg&quot;})">
              <textarea id="specs" className="admin-textarea admin-textarea-code" value={form.specs} onChange={(e) => updateField('specs', e.target.value)} rows={8} />
            </FormField>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="admin-form-grid">
            <FormField label="시공 갤러리 (JSON)" htmlFor="installation_gallery" description="갤러리 이미지 배열 (JSON 형식)">
              <textarea id="installation_gallery" className="admin-textarea admin-textarea-code" value={form.installation_gallery} onChange={(e) => updateField('installation_gallery', e.target.value)} rows={12} />
            </FormField>
          </div>
        )}

        {activeTab === 'related' && (
          <div className="admin-form-grid">
            <FormField label="연관 상품" description="연관 상품을 선택하세요">
              <div className="admin-checkbox-list">
                {allProducts
                  .filter((p) => p.id !== id)
                  .map((p) => (
                    <label key={p.id} className="admin-checkbox-item">
                      <input
                        type="checkbox"
                        checked={form.related_product_ids.includes(p.id)}
                        onChange={() => handleRelatedToggle(p.id)}
                      />
                      <span>{p.name}</span>
                    </label>
                  ))}
              </div>
            </FormField>
          </div>
        )}
      </div>

      <ConfirmModal isOpen={showDelete} title="제품 삭제" message="이 제품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다." confirmLabel="삭제" cancelLabel="취소" variant="danger" onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={deleting} />
    </div>
  );
}
