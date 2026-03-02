import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { Product, ProductCategory } from '../../../types/admin';
import type { Json } from '../../../types/database';
import {
  FormField,
  Toggle,
  TabNav,
  TagInput,
  LoadingSpinner,
  ConfirmModal,
  ImageUploader,
  ImageListEditor,
  KeyValueEditor,
  OptionGroupEditor,
  InstallationGalleryEditor,
  ProductionStepsEditor,
} from '../ui';
import type { OptionsData, GalleryItem, StepItem } from '../ui';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Trash2, Bookmark } from 'lucide-react';

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
  images: string[];
  material_images: Record<string, string>;
  lighting_images: Record<string, string>;
  options: OptionsData;
  production_time: string;
  included_services: string[];
  features: string[];
  specs: Record<string, string>;
  installation_gallery: GalleryItem[];
  production_steps: StepItem[];
  related_product_ids: string[];
}

function safeJsonParse(val: Json, fallback: any): any {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback; }
  }
  return fallback;
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
    images: [],
    material_images: {},
    lighting_images: {},
    options: {},
    production_time: '',
    included_services: [],
    features: [],
    specs: {},
    installation_gallery: [],
    production_steps: [],
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
    images: safeJsonParse(p.images as Json, []),
    material_images: safeJsonParse(p.material_images as Json, {}),
    lighting_images: safeJsonParse(p.lighting_images as Json, {}),
    options: safeJsonParse(p.options as Json, {}),
    production_time: p.production_time ?? '',
    included_services: Array.isArray(p.included_services) ? (p.included_services as string[]) : [],
    features: Array.isArray(p.features) ? (p.features as string[]) : [],
    specs: safeJsonParse(p.specs as Json, {}),
    installation_gallery: safeJsonParse(p.installation_gallery as Json, []),
    production_steps: safeJsonParse(p.production_steps as Json, []),
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
  const [savingDefaults, setSavingDefaults] = useState(false);
  const saveLockRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  const updateField = useCallback(<K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name, description, defaults, order_index, is_visible, is_seed, updated_at')
        .order('order_index');
      if (error) {
        console.error('카테고리 로딩 실패:', error.message);
        toast.error('카테고리 목록을 불러올 수 없습니다');
        return;
      }
      setCategories(data ?? []);
    }
    async function loadProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .order('name');
      if (error) {
        console.error('상품 목록 로딩 실패:', error.message);
        toast.error('상품 목록을 불러올 수 없습니다');
        return;
      }
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
        .select('id, slug, name, category_id, price, price_range, thumbnail, images, description, full_description, features, specs, production_time, included_services, tags, material_images, lighting_images, options, production_steps, installation_gallery, popularity, is_new, is_featured, related_product_ids, is_visible, is_seed, is_fixed_price, fixed_price, created_at, updated_at')
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
    // 레이스 컨디션 방지: useRef 기반 잠금
    if (saveLockRef.current) return;

    const currentForm = formRef.current;

    if (!currentForm.name.trim()) {
      toast.error('제품명을 입력해 주세요');
      return;
    }

    // 썸네일 미설정 경고
    if (!currentForm.thumbnail) {
      toast('썸네일이 설정되지 않았습니다. 쇼핑몰에서 이미지가 표시되지 않을 수 있습니다.', {
        icon: '⚠️',
        duration: 4000,
      });
    }

    saveLockRef.current = true;
    setSaving(true);
    const slug = currentForm.slug || toSlug(currentForm.name) || `product-${Date.now()}`;
    const payload = {
      name: currentForm.name,
      slug,
      category_id: currentForm.category_id || null,
      price: currentForm.price,
      price_range: currentForm.price_range || null,
      description: currentForm.description || null,
      full_description: currentForm.full_description || null,
      tags: currentForm.tags as Json,
      is_visible: currentForm.is_visible,
      is_featured: currentForm.is_featured,
      is_new: currentForm.is_new,
      popularity: currentForm.popularity,
      thumbnail: currentForm.thumbnail,
      images: currentForm.images as unknown as Json,
      material_images: currentForm.material_images as unknown as Json,
      lighting_images: currentForm.lighting_images as unknown as Json,
      options: currentForm.options as unknown as Json,
      production_time: currentForm.production_time || null,
      included_services: currentForm.included_services as Json,
      features: currentForm.features as Json,
      specs: currentForm.specs as unknown as Json,
      installation_gallery: currentForm.installation_gallery as unknown as Json,
      production_steps: currentForm.production_steps as unknown as Json,
      related_product_ids: currentForm.related_product_ids as Json,
    };

    try {
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
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }, [isNew, id, navigate]);

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

  const handleCategoryChange = useCallback((categoryId: string) => {
    setForm((prev) => {
      const updated = { ...prev, category_id: categoryId };
      if (!isNew || !categoryId) return updated;
      const cat = categories.find((c) => c.id === categoryId);
      const defaults = safeJsonParse(cat?.defaults as Json, {}) as Record<string, unknown>;
      if (!defaults || Object.keys(defaults).length === 0) return updated;
      const isEmpty = (v: unknown) =>
        v === '' || v === null || v === undefined ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);
      const keys = Object.keys(defaults) as (keyof ProductForm)[];
      for (const key of keys) {
        if (key in updated && isEmpty(updated[key])) {
          (updated as any)[key] = defaults[key];
        }
      }
      toast.success('카테고리 기본값이 적용되었습니다');
      return updated;
    });
  }, [isNew, categories]);

  const handleSaveDefaults = useCallback(async (tab: string) => {
    if (!form.category_id) {
      toast.error('카테고리를 먼저 선택해 주세요');
      return;
    }
    const cat = categories.find((c) => c.id === form.category_id);
    if (!cat) return;
    const existing = safeJsonParse(cat.defaults as Json, {}) as Record<string, unknown>;
    let tabFields: Record<string, unknown> = {};
    switch (tab) {
      case 'images':
        tabFields = { material_images: form.material_images, lighting_images: form.lighting_images };
        break;
      case 'options':
        tabFields = { options: form.options };
        break;
      case 'production':
        tabFields = { production_time: form.production_time, included_services: form.included_services, features: form.features, specs: form.specs, production_steps: form.production_steps };
        break;
      case 'gallery':
        tabFields = { installation_gallery: form.installation_gallery };
        break;
      default:
        return;
    }
    const merged = { ...existing, ...tabFields };
    setSavingDefaults(true);
    const { error } = await supabase
      .from('product_categories')
      .update({ defaults: merged as unknown as Json })
      .eq('id', form.category_id);
    if (error) {
      toast.error('기본값 저장에 실패했습니다');
    } else {
      setCategories((prev) => prev.map((c) => c.id === form.category_id ? { ...c, defaults: merged as Json } : c));
      toast.success('기본값으로 저장되었습니다');
    }
    setSavingDefaults(false);
  }, [form, categories]);

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
              <select id="category_id" className="admin-select" value={form.category_id} onChange={(e) => handleCategoryChange(e.target.value)}>
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
            <FormField label="썸네일">
              <ImageUploader value={form.thumbnail} onChange={(url) => updateField('thumbnail', url)} folder="products" />
            </FormField>
            <FormField label="이미지 목록" description="드래그로 순서를 변경할 수 있습니다">
              <ImageListEditor images={form.images} onChange={(imgs) => updateField('images', imgs)} folder="products" />
            </FormField>
            <FormField label="소재 이미지" description="소재명과 이미지를 등록하세요">
              <KeyValueEditor
                entries={form.material_images}
                onChange={(entries) => updateField('material_images', entries)}
                keyLabel="소재명"
                valueLabel="이미지"
                valueType="image"
                folder="products"
              />
            </FormField>
            <FormField label="조명 이미지" description="조명 상태별 이미지를 등록하세요 (off/on)">
              <KeyValueEditor
                entries={form.lighting_images}
                onChange={(entries) => updateField('lighting_images', entries)}
                keyLabel="상태"
                valueLabel="이미지"
                valueType="image"
                folder="products"
              />
            </FormField>
            <div className="admin-defaults-bar">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleSaveDefaults('images')} disabled={savingDefaults}>
                <Bookmark size={14} /> 기본값으로 저장
              </button>
            </div>
          </div>
        )}

        {activeTab === 'options' && (
          <div className="admin-form-grid">
            <FormField label="제품 옵션" description="사이즈, 소재, 마감, 조명 옵션을 관리합니다">
              <OptionGroupEditor options={form.options} onChange={(opts) => updateField('options', opts)} />
            </FormField>
            <div className="admin-defaults-bar">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleSaveDefaults('options')} disabled={savingDefaults}>
                <Bookmark size={14} /> 기본값으로 저장
              </button>
            </div>
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
            <FormField label="스펙" description="제품 사양을 입력하세요">
              <KeyValueEditor
                entries={form.specs}
                onChange={(entries) => updateField('specs', entries)}
                keyLabel="항목"
                valueLabel="값"
              />
            </FormField>
            <FormField label="제작 과정" description="드래그로 순서를 변경할 수 있습니다">
              <ProductionStepsEditor steps={form.production_steps} onChange={(steps) => updateField('production_steps', steps)} />
            </FormField>
            <div className="admin-defaults-bar">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleSaveDefaults('production')} disabled={savingDefaults}>
                <Bookmark size={14} /> 기본값으로 저장
              </button>
            </div>
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="admin-form-grid">
            <FormField label="시공 갤러리" description="시공 전/후 이미지와 위치를 등록하세요">
              <InstallationGalleryEditor items={form.installation_gallery} onChange={(items) => updateField('installation_gallery', items)} />
            </FormField>
            <div className="admin-defaults-bar">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleSaveDefaults('gallery')} disabled={savingDefaults}>
                <Bookmark size={14} /> 기본값으로 저장
              </button>
            </div>
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
