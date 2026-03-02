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
import { ArrowLeft, Save, Trash2, Bookmark, ChevronDown, ChevronRight } from 'lucide-react';

const TABS = [
  { key: 'basic', label: '기본 정보' },
  { key: 'images', label: '이미지' },
  { key: 'options', label: '옵션' },
  { key: 'production', label: '제작 정보' },
  { key: 'gallery', label: '시공 갤러리' },
];

interface ProductForm {
  name: string;
  slug: string;
  category_id: string;
  price: string;
  price_range: string;
  is_fixed_price: boolean;
  fixed_price: number | null;
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
    is_fixed_price: false,
    fixed_price: null,
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
    is_fixed_price: (p as any).is_fixed_price ?? false,
    fixed_price: (p as any).fixed_price ?? null,
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

  // UI 상태
  const [slugEditing, setSlugEditing] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [showMaterialImages, setShowMaterialImages] = useState(false);
  const [showLightingImages, setShowLightingImages] = useState(false);

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
      const loaded = productToForm(data);
      setForm(loaded);
      // 기존 데이터가 있으면 이미지 섹션 열기
      setShowMaterialImages(Object.keys(safeJsonParse(data.material_images as Json, {})).length > 0);
      setShowLightingImages(Object.keys(safeJsonParse(data.lighting_images as Json, {})).length > 0);
      setLoading(false);
    }
    loadProduct();
  }, [id, isNew, navigate]);

  const handleSave = useCallback(async () => {
    if (saveLockRef.current) return;

    const currentForm = formRef.current;

    if (!currentForm.name.trim()) {
      toast.error('제품명을 입력해 주세요');
      return;
    }
    if (!currentForm.thumbnail) {
      toast('썸네일이 설정되지 않았습니다. 쇼핑몰에서 이미지가 표시되지 않을 수 있습니다.', {
        icon: '⚠️',
        duration: 4000,
      });
    }

    saveLockRef.current = true;
    setSaving(true);
    const slug = currentForm.slug || toSlug(currentForm.name) || `product-${Date.now()}`;

    // 고정가격 상품은 price 필드를 자동 생성
    const priceValue = currentForm.is_fixed_price && currentForm.fixed_price
      ? `${currentForm.fixed_price.toLocaleString('ko-KR')}원`
      : currentForm.price;

    const payload = {
      name: currentForm.name,
      slug,
      category_id: currentForm.category_id || null,
      price: priceValue,
      price_range: currentForm.price_range || null,
      is_fixed_price: currentForm.is_fixed_price,
      fixed_price: currentForm.is_fixed_price ? (currentForm.fixed_price ?? null) : null,
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
        {/* ── 기본 정보 탭 ── */}
        {activeTab === 'basic' && (
          <div className="admin-form-grid">
            {/* 제품명 + 슬러그 인라인 미리보기 */}
            <FormField label="제품명" required htmlFor="name">
              <input
                id="name"
                className="admin-input"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
              <div className="admin-slug-preview">
                <span className="admin-slug-label">슬러그:</span>
                {slugEditing ? (
                  <input
                    autoFocus
                    className="admin-input admin-input-sm"
                    value={form.slug}
                    onChange={(e) => updateField('slug', e.target.value)}
                    onBlur={() => setSlugEditing(false)}
                  />
                ) : (
                  <>
                    <code className="admin-slug-value">{form.slug || toSlug(form.name) || '—'}</code>
                    <button type="button" className="admin-btn-link" onClick={() => setSlugEditing(true)}>
                      편집
                    </button>
                  </>
                )}
              </div>
            </FormField>

            {/* 카테고리 */}
            <FormField label="카테고리" htmlFor="category_id">
              <select
                id="category_id"
                className="admin-select"
                value={form.category_id}
                onChange={(e) => handleCategoryChange(e.target.value)}
              >
                <option value="">선택 안함</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </FormField>

            {/* 가격 섹션 */}
            <FormField label="고정가격 상품" description="활성화하면 '바로 구매' 버튼이 표시됩니다">
              <Toggle
                checked={form.is_fixed_price}
                onChange={(v) => updateField('is_fixed_price', v)}
                label="고정가격 사용"
              />
            </FormField>

            {form.is_fixed_price ? (
              <FormField label="판매가 (원)" htmlFor="fixed_price" required description="실제 결제 금액. 최소 100원 이상">
                <input
                  id="fixed_price"
                  type="text"
                  inputMode="numeric"
                  className="admin-input"
                  value={form.fixed_price != null ? form.fixed_price.toLocaleString('ko-KR') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/,/g, '');
                    updateField('fixed_price', raw ? Number(raw) : null);
                  }}
                  placeholder="예: 150,000"
                />
              </FormField>
            ) : (
              <>
                <FormField label="가격 표시" htmlFor="price" description="상품 카드에 표시되는 텍스트">
                  <input
                    id="price"
                    className="admin-input"
                    value={form.price}
                    onChange={(e) => updateField('price', e.target.value)}
                    placeholder="예: 문의, 상담 후 결정"
                  />
                </FormField>
                <FormField label="가격 범위" htmlFor="price_range" description="상세 페이지 가격 안내 (선택)">
                  <input
                    id="price_range"
                    className="admin-input"
                    value={form.price_range}
                    onChange={(e) => updateField('price_range', e.target.value)}
                    placeholder="예: 100만원~300만원"
                  />
                </FormField>
              </>
            )}

            {/* 설명 */}
            <FormField label="카드 설명" htmlFor="description" description="상품 목록 카드에 표시되는 짧은 소개 (1~2줄 권장)">
              <textarea
                id="description"
                className="admin-textarea"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
              />
            </FormField>
            <FormField label="상세 설명" htmlFor="full_description" description="상품 상세 페이지에 표시되는 전체 설명">
              <textarea
                id="full_description"
                className="admin-textarea"
                value={form.full_description}
                onChange={(e) => updateField('full_description', e.target.value)}
                rows={6}
              />
            </FormField>

            {/* 태그 */}
            <FormField label="태그">
              <TagInput
                tags={form.tags}
                onChange={(tags) => updateField('tags', tags)}
                placeholder="태그 입력..."
              />
            </FormField>

            {/* 인기도 슬라이더 */}
            <FormField label={`인기도 (${form.popularity})`} htmlFor="popularity">
              <input
                id="popularity"
                type="range"
                className="admin-range"
                min={0}
                max={100}
                step={1}
                value={form.popularity}
                onChange={(e) => updateField('popularity', Number(e.target.value))}
              />
            </FormField>

            {/* 공개 상태 토글 */}
            <div className="admin-toggle-group">
              <Toggle checked={form.is_visible} onChange={(v) => updateField('is_visible', v)} label="공개" />
              <Toggle checked={form.is_featured} onChange={(v) => updateField('is_featured', v)} label="추천" />
              <Toggle checked={form.is_new} onChange={(v) => updateField('is_new', v)} label="신제품" />
            </div>

            {/* 연관 상품 — 접힘 섹션 */}
            <div className="admin-collapsible">
              <button
                type="button"
                className="admin-collapsible-header"
                onClick={() => setShowRelated((v) => !v)}
              >
                {showRelated ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>연관 상품</span>
                {form.related_product_ids.length > 0 && (
                  <span className="admin-badge admin-badge-info">{form.related_product_ids.length}</span>
                )}
              </button>
              {showRelated && (
                <div className="admin-checkbox-list admin-collapsible-body">
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
              )}
            </div>
          </div>
        )}

        {/* ── 이미지 탭 ── */}
        {activeTab === 'images' && (
          <div className="admin-form-grid">
            <FormField label="썸네일">
              <ImageUploader value={form.thumbnail} onChange={(url) => updateField('thumbnail', url)} folder="products" />
            </FormField>
            <FormField label="이미지 목록" description="드래그로 순서를 변경할 수 있습니다">
              <ImageListEditor images={form.images} onChange={(imgs) => updateField('images', imgs)} folder="products" />
            </FormField>

            {/* 소재 이미지 — 접힘 */}
            <div className="admin-collapsible">
              <button
                type="button"
                className="admin-collapsible-header"
                onClick={() => setShowMaterialImages((v) => !v)}
              >
                {showMaterialImages ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>소재 이미지</span>
                {Object.keys(form.material_images).length > 0 && (
                  <span className="admin-badge">{Object.keys(form.material_images).length}</span>
                )}
                <span className="admin-optional-hint">선택 사항</span>
              </button>
              {showMaterialImages && (
                <div className="admin-collapsible-body">
                  <KeyValueEditor
                    entries={form.material_images}
                    onChange={(entries) => updateField('material_images', entries)}
                    keyLabel="소재명"
                    valueLabel="이미지"
                    valueType="image"
                    folder="products"
                  />
                </div>
              )}
            </div>

            {/* 조명 이미지 — 접힘 */}
            <div className="admin-collapsible">
              <button
                type="button"
                className="admin-collapsible-header"
                onClick={() => setShowLightingImages((v) => !v)}
              >
                {showLightingImages ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>조명 이미지</span>
                {Object.keys(form.lighting_images).length > 0 && (
                  <span className="admin-badge">{Object.keys(form.lighting_images).length}</span>
                )}
                <span className="admin-optional-hint">선택 사항</span>
              </button>
              {showLightingImages && (
                <div className="admin-collapsible-body">
                  <KeyValueEditor
                    entries={form.lighting_images}
                    onChange={(entries) => updateField('lighting_images', entries)}
                    keyLabel="상태"
                    valueLabel="이미지"
                    valueType="image"
                    folder="products"
                  />
                </div>
              )}
            </div>

            <div className="admin-defaults-bar">
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleSaveDefaults('images')} disabled={savingDefaults}>
                <Bookmark size={14} /> 기본값으로 저장
              </button>
            </div>
          </div>
        )}

        {/* ── 옵션 탭 ── */}
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

        {/* ── 제작 정보 탭 ── */}
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

        {/* ── 시공 갤러리 탭 ── */}
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
      </div>

      <ConfirmModal
        isOpen={showDelete}
        title="제품 삭제"
        message="이 제품을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
        loading={deleting}
      />

      <style>{`
        .admin-slug-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-muted, #888);
        }
        .admin-slug-label {
          font-weight: 500;
          flex-shrink: 0;
        }
        .admin-slug-value {
          background: var(--bg-subtle, #f5f5f5);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
          color: var(--text-secondary, #555);
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .admin-btn-link {
          background: none;
          border: none;
          color: var(--primary, #3b82f6);
          font-size: 12px;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          flex-shrink: 0;
        }
        .admin-input-sm {
          height: 28px;
          font-size: 12px;
          padding: 2px 8px;
          flex: 1;
        }
        .admin-range {
          width: 100%;
          cursor: pointer;
          accent-color: var(--primary, #3b82f6);
        }
        .admin-collapsible {
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 8px;
          overflow: hidden;
        }
        .admin-collapsible-header {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-subtle, #f9fafb);
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #111);
          text-align: left;
          transition: background 0.15s;
        }
        .admin-collapsible-header:hover {
          background: var(--bg-hover, #f3f4f6);
        }
        .admin-collapsible-body {
          padding: 16px;
          border-top: 1px solid var(--border, #e5e7eb);
        }
        .admin-optional-hint {
          margin-left: auto;
          font-size: 11px;
          color: var(--text-muted, #9ca3af);
          font-weight: 400;
        }
      `}</style>
    </div>
  );
}
