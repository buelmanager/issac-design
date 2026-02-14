import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { HeroSlide, LandingSection, TrustIndicator, ClientLogo } from '../../../types/admin';
import { FormField, Toggle, TabNav, DragSortList, LoadingSpinner } from '../ui';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

const TABS = [
  { key: 'hero', label: 'Shop Hero' },
  { key: 'featured', label: 'Featured Bento' },
  { key: 'trust', label: 'Trust Indicators' },
  { key: 'logos', label: 'Client Logos' },
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    switch (activeTab) {
      case 'hero': {
        const { data } = await supabase.from('hero_slides').select('*').eq('page', 'shop').order('slide_index');
        setHeroSlides((data ?? []) as HeroSlide[]);
        break;
      }
      case 'featured': {
        const { data } = await supabase.from('landing_sections').select('*').ilike('section_key', '%featured%').single();
        setFeaturedSection((data ?? null) as LandingSection | null);
        break;
      }
      case 'trust': {
        const { data } = await supabase.from('trust_indicators').select('*').order('order_index');
        setTrustIndicators((data ?? []) as TrustIndicator[]);
        break;
      }
      case 'logos': {
        const { data } = await supabase.from('client_logos').select('*').order('order_index');
        setClientLogos((data ?? []) as ClientLogo[]);
        break;
      }
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateHeroSlide = (id: string, field: keyof HeroSlide, value: string | null) => {
    setHeroSlides((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSaveHeroSlide = async (slide: HeroSlide) => {
    setSaving(true);
    const { error } = await supabase.from('hero_slides').update({
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
    }).eq('id', slide.id);
    if (error) toast.error('저장 실패');
    else toast.success('슬라이드 저장 완료');
    setSaving(false);
  };

  const handleSaveAllHero = async () => {
    setSaving(true);
    let hasError = false;
    for (const s of heroSlides) {
      const { error } = await supabase.from('hero_slides').update({
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
      }).eq('id', s.id);
      if (error) hasError = true;
    }
    if (hasError) toast.error('일부 슬라이드 저장 실패');
    else toast.success('전체 슬라이드 저장 완료');
    setSaving(false);
  };

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

  const renderHeroTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">Shop Hero 슬라이드</h2>
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveAllHero}>
          <Save size={16} /> 전체 저장
        </button>
      </div>
      {heroSlides.map((slide) => (
        <div key={slide.id} className="admin-card">
          <div className="admin-card-header" onClick={() => setExpandedSlide(expandedSlide === slide.id ? null : slide.id)}>
            <h3 className="admin-card-title">슬라이드 {slide.slide_index + 1}: {slide.title_line1}</h3>
            <span>{expandedSlide === slide.id ? '▲' : '▼'}</span>
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
                <input className="admin-input" value={slide.cta_primary_link ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'cta_primary_link', e.target.value)} />
              </FormField>
              <FormField label="CTA Secondary Text">
                <input className="admin-input" value={slide.cta_secondary_text ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'cta_secondary_text', e.target.value)} />
              </FormField>
              <FormField label="CTA Secondary Link">
                <input className="admin-input" value={slide.cta_secondary_link ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'cta_secondary_link', e.target.value)} />
              </FormField>
              <FormField label="Video URL">
                <input className="admin-input" value={slide.video_url ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'video_url', e.target.value)} />
              </FormField>
              <FormField label="Video WebM URL">
                <input className="admin-input" value={slide.video_webm_url ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'video_webm_url', e.target.value)} />
              </FormField>
              <FormField label="Poster URL">
                <input className="admin-input" value={slide.poster_url ?? ''} onChange={(e) => updateHeroSlide(slide.id, 'poster_url', e.target.value)} />
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

  const renderLogosTab = () => (
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
          <div className="admin-drag-item-content">
            <div className="admin-form-group">
              <input className="admin-input" value={item.name} placeholder="이름" onChange={(e) => updateClientLogo(item.id, 'name', e.target.value)} />
              <input className="admin-input" value={item.logo_url} placeholder="로고 URL" onChange={(e) => updateClientLogo(item.id, 'logo_url', e.target.value)} />
              <input className="admin-input" value={item.website_url ?? ''} placeholder="웹사이트 URL" onChange={(e) => updateClientLogo(item.id, 'website_url', e.target.value)} />
            </div>
            <Toggle checked={item.is_visible} onChange={(v) => updateClientLogo(item.id, 'is_visible', v)} label="표시" />
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteClientLogo(item.id)}>
              <Trash2 size={14} />
            </button>
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
      case 'trust': return renderTrustTab();
      case 'logos': return renderLogosTab();
      default: return null;
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-card-title">쇼핑몰 설정</h1>
      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {renderTabContent()}
    </div>
  );
}
