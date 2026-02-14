import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { HeroSlide, LandingSection, TrustIndicator, ClientLogo } from '../../../types/admin';
import { FormField, Toggle, TabNav, DragSortList, LoadingSpinner, ImageUploader, LinkSelect } from '../ui';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Save, Upload, Link as LinkIcon, X, Loader2, AlertCircle, Film } from 'lucide-react';

// ─── Video Upload ──────────────────────────────
const VIDEO_MAX_SIZE = 5 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

async function uploadVideo(file: File, folder: string): Promise<string> {
  if (!VIDEO_TYPES.includes(file.type)) {
    throw new Error('MP4, WebM, MOV 형식의 영상만 업로드할 수 있습니다.');
  }
  if (file.size > VIDEO_MAX_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`영상 크기(${sizeMB}MB)가 제한(5MB)을 초과합니다.`);
  }
  const ext = file.name.split('.').pop() ?? 'mp4';
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('images').upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error('영상 업로드에 실패했습니다.');
  const { data: urlData } = supabase.storage.from('images').getPublicUrl(fileName);
  return urlData.publicUrl;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function VideoUploader({ value, onChange, folder = 'shop' }: { value: string; onChange: (url: string) => void; folder?: string }) {
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setDragOver(false);
    try {
      const url = await uploadVideo(file, folder);
      onChange(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '업로드에 실패했습니다';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [folder, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUrlConfirm = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!isValidUrl(trimmed)) {
      setError('올바른 URL 형식이 아닙니다.');
      return;
    }
    setError(null);
    onChange(trimmed);
    setUrlInput('');
  }, [urlInput, onChange]);

  return (
    <div className="video-uploader">
      {value ? (
        <div className="video-uploader-preview">
          <video src={value} controls className="settings-video-preview" />
          <button type="button" className="video-uploader-remove" onClick={() => onChange('')}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="video-uploader-tabs">
            <button type="button" className={`video-uploader-tab ${mode === 'upload' ? 'video-uploader-tab-active' : ''}`} onClick={() => { setMode('upload'); setError(null); }}>
              <Upload size={14} /> 파일 업로드
            </button>
            <button type="button" className={`video-uploader-tab ${mode === 'url' ? 'video-uploader-tab-active' : ''}`} onClick={() => { setMode('url'); setError(null); }}>
              <LinkIcon size={14} /> URL 입력
            </button>
          </div>

          {mode === 'upload' ? (
            <div
              className={`video-uploader-drop ${dragOver ? 'video-uploader-drop-active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="video-uploader-progress">
                  <Loader2 size={24} className="img-uploader-spinner" />
                  <span>업로드 중...</span>
                </div>
              ) : (
                <>
                  <Film size={32} className="settings-upload-icon" />
                  <p>클릭 또는 드래그하여 영상 업로드</p>
                  <p className="video-uploader-hint">MP4, WebM (최대 5MB)</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="settings-file-input-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <div className="video-uploader-url">
              <input
                className="admin-input"
                value={urlInput}
                onChange={(e) => { setUrlInput(e.target.value); setError(null); }}
                placeholder="https://..."
                onKeyDown={(e) => e.key === 'Enter' && handleUrlConfirm()}
              />
              <button type="button" className="admin-btn admin-btn-primary" onClick={handleUrlConfirm} disabled={!urlInput.trim() || !isValidUrl(urlInput.trim())}>
                확인
              </button>
            </div>
          )}

          {error && (
            <div className="video-uploader-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 탭 설정 ──────────────────────────────────
const TABS = [
  { key: 'hero', label: 'Shop Hero' },
  { key: 'featured', label: '추천' },
  { key: 'new-arrivals', label: '신제품' },
  { key: 'products', label: '제품' },
  { key: 'process', label: '프로세스' },
  { key: 'trust', label: '신뢰' },
  { key: 'clients', label: '고객' },
];

export default function ShopSettingsPage() {
  const [activeTab, setActiveTab] = useState('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [expandedSlide, setExpandedSlide] = useState<string | null>(null);

  const [featuredSection, setFeaturedSection] = useState<LandingSection | null>(null);

  const [trustIndicators, setTrustIndicators] = useState<TrustIndicator[]>([]);

  const [clientLogos, setClientLogos] = useState<ClientLogo[]>([]);

  const [newArrivalsSection, setNewArrivalsSection] = useState<LandingSection | null>(null);
  const [productsSection, setProductsSection] = useState<LandingSection | null>(null);
  const [processSection, setProcessSection] = useState<LandingSection | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    switch (activeTab) {
      case 'hero': {
        const { data } = await supabase.from('hero_slides').select('*').eq('page', 'shop').order('slide_index');
        setHeroSlides((data ?? []) as HeroSlide[]);
        break;
      }
      case 'featured': {
        const { data } = await supabase.from('landing_sections').select('*').eq('section_key', 'shop_featured').single();
        setFeaturedSection((data ?? null) as LandingSection | null);
        break;
      }
      case 'trust': {
        const { data } = await supabase.from('trust_indicators').select('*').order('order_index');
        setTrustIndicators((data ?? []) as TrustIndicator[]);
        break;
      }
      case 'new-arrivals': {
        const { data } = await supabase.from('landing_sections').select('*').eq('section_key', 'shop_new_arrivals').single();
        setNewArrivalsSection(data ? (data as LandingSection) : {
          id: '', section_key: 'shop_new_arrivals', title: '신제품', subtitle: '새롭게 출시된 제품을 만나보세요',
          description: null, eyebrow: null, is_visible: true, order_index: 2, extra_data: null, is_seed: false, updated_at: '', updated_by: null,
        } as LandingSection);
        break;
      }
      case 'products': {
        const { data } = await supabase.from('landing_sections').select('*').eq('section_key', 'shop_products').single();
        setProductsSection(data ? (data as LandingSection) : {
          id: '', section_key: 'shop_products', title: '전체 제품', subtitle: '다양한 간판 제품을 만나보세요',
          description: null, eyebrow: null, is_visible: true, order_index: 3, extra_data: null, is_seed: false, updated_at: '', updated_by: null,
        } as LandingSection);
        break;
      }
      case 'process': {
        const { data } = await supabase.from('landing_sections').select('*').eq('section_key', 'shop_process').single();
        setProcessSection(data ? (data as LandingSection) : {
          id: '', section_key: 'shop_process', title: '주문 프로세스', subtitle: '간판 제작, 이렇게 진행됩니다',
          description: null, eyebrow: null, is_visible: true, order_index: 4, extra_data: null, is_seed: false, updated_at: '', updated_by: null,
        } as LandingSection);
        break;
      }
      case 'clients': {
        const { data } = await supabase.from('client_logos').select('*').order('order_index');
        setClientLogos((data ?? []) as ClientLogo[]);
        break;
      }
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Hero ───────────────────────────────────
  const updateHeroSlide = (id: string, field: keyof HeroSlide, value: string | null) => {
    setHeroSlides((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const addHeroSlide = () => {
    const newSlide: HeroSlide = {
      id: crypto.randomUUID(),
      page: 'shop',
      slide_index: heroSlides.length,
      eyebrow: '',
      title_line1: '새 슬라이드',
      title_line2: '',
      subtitle: '',
      description: null,
      cta_primary_text: null,
      cta_primary_link: null,
      cta_secondary_text: null,
      cta_secondary_link: null,
      video_url: null,
      video_webm_url: null,
      poster_url: null,
      is_visible: true,
      order_index: heroSlides.length,
      is_seed: false,
      updated_at: new Date().toISOString(),
    };
    setHeroSlides((prev) => [...prev, newSlide]);
  };

  const deleteHeroSlide = async (id: string) => {
    const { error } = await supabase.from('hero_slides').delete().eq('id', id);
    if (error) toast.error('삭제 실패');
    else {
      setHeroSlides((prev) => prev.filter((s) => s.id !== id));
      toast.success('슬라이드 삭제 완료');
    }
  };

  const handleSaveHeroSlide = async (slide: HeroSlide) => {
    setSaving(true);
    const { error } = await supabase.from('hero_slides').upsert({
      id: slide.id,
      page: 'shop',
      slide_index: slide.slide_index,
      order_index: slide.slide_index,
      eyebrow: slide.eyebrow,
      title_line1: slide.title_line1,
      title_line2: slide.title_line2,
      subtitle: slide.subtitle,
      cta_primary_text: slide.cta_primary_text,
      cta_primary_link: slide.cta_primary_link,
      cta_secondary_text: slide.cta_secondary_text,
      cta_secondary_link: slide.cta_secondary_link,
      video_url: slide.video_url,
      video_webm_url: slide.video_webm_url,
      poster_url: slide.poster_url,
    });
    if (error) toast.error('저장 실패');
    else toast.success('슬라이드 저장 완료');
    setSaving(false);
  };

  const handleSaveAllHero = async () => {
    setSaving(true);
    let hasError = false;
    for (let idx = 0; idx < heroSlides.length; idx++) {
      const s = heroSlides[idx];
      const { error } = await supabase.from('hero_slides').upsert({
        id: s.id,
        page: 'shop',
        slide_index: idx,
        order_index: idx,
        eyebrow: s.eyebrow,
        title_line1: s.title_line1,
        title_line2: s.title_line2,
        subtitle: s.subtitle,
        cta_primary_text: s.cta_primary_text,
        cta_primary_link: s.cta_primary_link,
        cta_secondary_text: s.cta_secondary_text,
        cta_secondary_link: s.cta_secondary_link,
        video_url: s.video_url,
        video_webm_url: s.video_webm_url,
        poster_url: s.poster_url,
      });
      if (error) hasError = true;
    }
    if (hasError) toast.error('일부 슬라이드 저장 실패');
    else toast.success('전체 슬라이드 저장 완료');
    setSaving(false);
  };

  // ─── Featured ───────────────────────────────
  const handleSaveFeatured = async () => {
    if (!featuredSection) return;
    setSaving(true);
    const { error } = await supabase.from('landing_sections').update({
      title: featuredSection.title,
      subtitle: featuredSection.subtitle,
    }).eq('id', featuredSection.id);
    if (error) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  // ─── Section Header Save (generic) ──────────
  const saveSectionHeader = async (
    section: LandingSection | null,
    sectionKey: string,
    setter: (s: LandingSection | null) => void,
  ) => {
    if (!section) return;
    setSaving(true);
    const title = section.title ?? '';
    const subtitle = section.subtitle ?? '';
    if (section.id) {
      const { error } = await supabase.from('landing_sections').update({ title, subtitle }).eq('id', section.id);
      if (error) toast.error('저장 실패');
      else toast.success('저장 완료');
    } else {
      const { data, error } = await supabase.from('landing_sections')
        .upsert({ section_key: sectionKey, title, subtitle, is_visible: true, order_index: section.order_index }, { onConflict: 'section_key' })
        .select().single();
      if (error) toast.error('저장 실패');
      else {
        setter(data as LandingSection);
        toast.success('저장 완료');
      }
    }
    setSaving(false);
  };

  // ─── Trust Indicators ───────────────────────
  const handleSaveTrust = async () => {
    setSaving(true);
    let hasError = false;
    for (let idx = 0; idx < trustIndicators.length; idx++) {
      const { error } = await supabase.from('trust_indicators').upsert({
        ...trustIndicators[idx],
        order_index: idx,
      });
      if (error) hasError = true;
    }
    if (hasError) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const updateTrustIndicator = (id: string, field: keyof TrustIndicator, value: string | boolean) => {
    setTrustIndicators((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  // ─── Client Logos ───────────────────────────
  const handleSaveLogos = async () => {
    setSaving(true);
    let hasError = false;
    for (let idx = 0; idx < clientLogos.length; idx++) {
      const { error } = await supabase.from('client_logos').upsert({
        ...clientLogos[idx],
        order_index: idx,
      });
      if (error) hasError = true;
    }
    if (hasError) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const updateClientLogo = (id: string, field: keyof ClientLogo, value: string | boolean) => {
    setClientLogos((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const addClientLogo = () => {
    const newLogo: ClientLogo = {
      id: crypto.randomUUID(),
      name: '새 로고',
      logo_url: '',
      website_url: null,
      order_index: clientLogos.length,
      is_visible: true,
      is_seed: false,
      updated_at: new Date().toISOString(),
    };
    setClientLogos((prev) => [...prev, newLogo]);
  };

  const deleteClientLogo = async (id: string) => {
    const { error } = await supabase.from('client_logos').delete().eq('id', id);
    if (error) toast.error('삭제 실패');
    else {
      setClientLogos((prev) => prev.filter((l) => l.id !== id));
      toast.success('삭제 완료');
    }
  };

  // ─── Tabs ───────────────────────────────────
  const renderHeroTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">Shop Hero 슬라이드</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="admin-btn admin-btn-secondary" onClick={addHeroSlide}>
            <Plus size={16} /> 추가
          </button>
          <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveAllHero}>
            <Save size={16} /> 전체 저장
          </button>
        </div>
      </div>
      {heroSlides.length === 0 && (
        <div className="admin-card">
          <div className="admin-card-body">
            <p className="admin-empty-text">슬라이드가 없습니다. "추가" 버튼으로 새 슬라이드를 만드세요.</p>
          </div>
        </div>
      )}
      {heroSlides.map((slide, idx) => (
        <div key={slide.id} className="admin-card">
          <div className="admin-card-header" onClick={() => setExpandedSlide(expandedSlide === slide.id ? null : slide.id)}>
            <h3 className="admin-card-title">슬라이드 {idx + 1}: {slide.title_line1}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={(e) => { e.stopPropagation(); deleteHeroSlide(slide.id); }}>
                <Trash2 size={14} />
              </button>
              <span>{expandedSlide === slide.id ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedSlide === slide.id && (
            <div className="admin-card-body">
              <FormField label="Eyebrow">
                <input className="admin-input" value={slide.eyebrow ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'eyebrow', e.target.value)} />
              </FormField>
              <FormField label="Title Line 1" required>
                <input className="admin-input" value={slide.title_line1} onChange={(e) => updateHeroSlide(slide.id, 'title_line1', e.target.value)} />
              </FormField>
              <FormField label="Title Line 2">
                <input className="admin-input" value={slide.title_line2 ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'title_line2', e.target.value)} />
              </FormField>
              <FormField label="Subtitle">
                <input className="admin-input" value={slide.subtitle ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'subtitle', e.target.value)} />
              </FormField>
              <FormField label="CTA Primary Text">
                <input className="admin-input" value={slide.cta_primary_text ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'cta_primary_text', e.target.value)} />
              </FormField>
              <FormField label="CTA Primary Link">
                <LinkSelect value={slide.cta_primary_link ?? ''} onChange={(v) => updateHeroSlide(slide.id, 'cta_primary_link', v)} />
              </FormField>
              <FormField label="CTA Secondary Text">
                <input className="admin-input" value={slide.cta_secondary_text ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'cta_secondary_text', e.target.value)} />
              </FormField>
              <FormField label="CTA Secondary Link">
                <LinkSelect value={slide.cta_secondary_link ?? ''} onChange={(v) => updateHeroSlide(slide.id, 'cta_secondary_link', v)} />
              </FormField>
              <FormField label="Video URL (MP4)">
                <VideoUploader value={slide.video_url ?? ''} onChange={(url) => updateHeroSlide(slide.id, 'video_url', url || null)} folder="shop" />
              </FormField>
              <FormField label="Video WebM URL">
                <VideoUploader value={slide.video_webm_url ?? ''} onChange={(url) => updateHeroSlide(slide.id, 'video_webm_url', url || null)} folder="shop" />
              </FormField>
              <FormField label="Poster 이미지">
                <ImageUploader value={slide.poster_url ?? ''} onChange={(url) => updateHeroSlide(slide.id, 'poster_url', url || null)} folder="shop" />
              </FormField>
              <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => handleSaveHeroSlide(slide)}>
                <Save size={16} /> 이 슬라이드 저장
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const renderFeaturedTab = () => (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">Featured Bento 섹션</h2>
      </div>
      <div className="admin-card-body">
        {featuredSection ? (
          <>
            <FormField label="제목">
              <input className="admin-input" value={featuredSection.title ?? ''} onChange={(e) => setFeaturedSection({ ...featuredSection, title: e.target.value })} />
            </FormField>
            <FormField label="부제">
              <input className="admin-input" value={featuredSection.subtitle ?? ''} onChange={(e) => setFeaturedSection({ ...featuredSection, subtitle: e.target.value })} />
            </FormField>
            <p className="admin-form-description">Featured 제품은 제품 관리에서 is_featured를 설정하면 자동으로 표시됩니다.</p>
            <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveFeatured}>
              <Save size={16} /> 저장
            </button>
          </>
        ) : (
          <p className="admin-empty-text">Featured 섹션 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  );

  const renderTrustTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">신뢰 지표</h2>
      </div>
      <DragSortList
        items={trustIndicators}
        keyExtractor={(item) => item.id}
        onReorder={setTrustIndicators}
        renderItem={(item) => (
          <div className="admin-drag-item-content">
            <div className="admin-form-group">
              <input className="admin-input" value={item.number_text} placeholder="숫자" onChange={(e) => updateTrustIndicator(item.id, 'number_text', e.target.value)} />
              <input className="admin-input" value={item.label} placeholder="라벨" onChange={(e) => updateTrustIndicator(item.id, 'label', e.target.value)} />
              <input className="admin-input" value={item.description} placeholder="설명" onChange={(e) => updateTrustIndicator(item.id, 'description', e.target.value)} />
            </div>
            <Toggle checked={item.is_visible} onChange={(v) => updateTrustIndicator(item.id, 'is_visible', v)} label="표시" />
          </div>
        )}
      />
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveTrust}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderSectionTab = (
    label: string,
    section: LandingSection | null,
    setter: (s: LandingSection | null) => void,
    sectionKey: string,
    description?: string,
  ) => (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2 className="admin-card-title">{label} 섹션</h2>
      </div>
      <div className="admin-card-body">
        <FormField label="제목">
          <input
            className="admin-input"
            value={section?.title ?? ''}
            onChange={(e) => setter(section ? { ...section, title: e.target.value } : null)}
          />
        </FormField>
        <FormField label="부제">
          <input
            className="admin-input"
            value={section?.subtitle ?? ''}
            onChange={(e) => setter(section ? { ...section, subtitle: e.target.value } : null)}
          />
        </FormField>
        {description && <p className="admin-form-description">{description}</p>}
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={() => saveSectionHeader(section, sectionKey, setter)}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderClientsTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">클라이언트 로고</h2>
        <button className="admin-btn admin-btn-secondary" onClick={addClientLogo}>
          <Plus size={16} /> 추가
        </button>
      </div>
      <DragSortList
        items={clientLogos}
        keyExtractor={(item) => item.id}
        onReorder={setClientLogos}
        renderItem={(item) => (
          <div className="admin-drag-item-content admin-drag-item-column">
            <div className="admin-drag-item-row">
              <div className="admin-form-group">
                <input className="admin-input" value={item.name} placeholder="이름" onChange={(e) => updateClientLogo(item.id, 'name', e.target.value)} />
                <input className="admin-input" value={item.website_url ?? ''} placeholder="웹사이트 URL" onChange={(e) => updateClientLogo(item.id, 'website_url', e.target.value)} />
              </div>
              <Toggle checked={item.is_visible} onChange={(v) => updateClientLogo(item.id, 'is_visible', v)} label="표시" />
              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteClientLogo(item.id)}>
                <Trash2 size={14} />
              </button>
            </div>
            <FormField label="로고 이미지">
              <ImageUploader value={item.logo_url} onChange={(url) => updateClientLogo(item.id, 'logo_url', url)} folder="logos" />
            </FormField>
          </div>
        )}
      />
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveLogos}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    if (loading) return <LoadingSpinner size="lg" />;
    switch (activeTab) {
      case 'hero': return renderHeroTab();
      case 'featured': return renderFeaturedTab();
      case 'new-arrivals': return renderSectionTab('신제품', newArrivalsSection, setNewArrivalsSection, 'shop_new_arrivals', '신제품 표시는 제품 관리에서 isNew를 설정하면 자동으로 표시됩니다.');
      case 'products': return renderSectionTab('제품', productsSection, setProductsSection, 'shop_products', '제품 목록은 제품 관리 페이지에서 관리합니다.');
      case 'process': return renderSectionTab('프로세스', processSection, setProcessSection, 'shop_process', '주문 프로세스 단계(상담→디자인→제작→설치→A/S) 순서를 표시합니다.');
      case 'trust': return renderTrustTab();
      case 'clients': return renderClientsTab();
      default: return null;
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">쇼핑몰 설정</h1>
          <p className="settings-page-subtitle">Shop Hero, 추천, 신제품, 제품, 프로세스, 신뢰, 고객 섹션 관리</p>
        </div>
      </div>
      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {renderTabContent()}
    </div>
  );
}
