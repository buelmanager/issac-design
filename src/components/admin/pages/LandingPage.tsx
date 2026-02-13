import { supabase } from '../../../lib/supabase';
import type { LandingSection, HeroSlide, ServiceItem, SignageType, ClientProject, ProjectFilterTab } from '../../../types/admin';
import type { LandingFaq, InquiryType, NavigationItem, SiteConfig } from '../../../types/admin';
import { FormField, Toggle, TabNav, DragSortList, LoadingSpinner, ConfirmModal } from '../ui';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

const TABS = [
  { key: 'hero', label: 'Hero' },
  { key: 'services', label: 'Services' },
  { key: 'signage', label: 'Signage Types' },
  { key: 'clients', label: 'Client Showcase' },
  { key: 'faq', label: 'FAQ' },
  { key: 'contact', label: 'Contact' },
  { key: 'footer', label: 'Footer' },
];

const CLIENT_CATEGORIES = ['restaurant', 'cafe', 'retail', 'office', 'other'];

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [expandedSlide, setExpandedSlide] = useState<string | null>(null);

  const [servicesSection, setServicesSection] = useState<LandingSection | null>(null);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);

  const [signageTypes, setSignageTypes] = useState<SignageType[]>([]);

  const [clientProjects, setClientProjects] = useState<ClientProject[]>([]);
  const [filterTabs, setFilterTabs] = useState<ProjectFilterTab[]>([]);

  const [faqs, setFaqs] = useState<LandingFaq[]>([]);

  const [contactSection, setContactSection] = useState<LandingSection | null>(null);
  const [inquiryTypes, setInquiryTypes] = useState<InquiryType[]>([]);

  const [footerConfigs, setFooterConfigs] = useState<SiteConfig[]>([]);
  const [footerQuickNav, setFooterQuickNav] = useState<NavigationItem[]>([]);
  const [footerServiceNav, setFooterServiceNav] = useState<NavigationItem[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    switch (activeTab) {
      case 'hero': {
        const { data } = await supabase.from('hero_slides').select('*').eq('page', 'landing').order('slide_index');
        setHeroSlides((data ?? []) as HeroSlide[]);
        break;
      }
      case 'services': {
        const sectionRes = await supabase.from('landing_sections').select('*').eq('section_key', 'services').single();
        const itemsRes = await supabase.from('service_items').select('*').order('order_index');
        setServicesSection((sectionRes.data ?? null) as LandingSection | null);
        setServiceItems((itemsRes.data ?? []) as ServiceItem[]);
        break;
      }
      case 'signage': {
        const { data } = await supabase.from('signage_types').select('*').order('order_index');
        setSignageTypes((data ?? []) as SignageType[]);
        break;
      }
      case 'clients': {
        const projRes = await supabase.from('client_projects').select('*').order('order_index');
        const tabRes = await supabase.from('project_filter_tabs').select('*').order('order_index');
        setClientProjects((projRes.data ?? []) as ClientProject[]);
        setFilterTabs((tabRes.data ?? []) as ProjectFilterTab[]);
        break;
      }
      case 'faq': {
        const { data } = await supabase.from('landing_faqs').select('*').order('order_index');
        setFaqs((data ?? []) as LandingFaq[]);
        break;
      }
      case 'contact': {
        const sectionRes = await supabase.from('landing_sections').select('*').eq('section_key', 'contact').single();
        const typesRes = await supabase.from('inquiry_types').select('*').order('order_index');
        setContactSection((sectionRes.data ?? null) as LandingSection | null);
        setInquiryTypes((typesRes.data ?? []) as InquiryType[]);
        break;
      }
      case 'footer': {
        const configRes = await supabase.from('site_config').select('*').in('category', ['footer', 'company', 'sns']);
        const quickRes = await supabase.from('navigation_items').select('*').eq('nav_type', 'footer_quick').order('order_index');
        const serviceRes = await supabase.from('navigation_items').select('*').eq('nav_type', 'footer_service').order('order_index');
        setFooterConfigs((configRes.data ?? []) as SiteConfig[]);
        setFooterQuickNav((quickRes.data ?? []) as NavigationItem[]);
        setFooterServiceNav((serviceRes.data ?? []) as NavigationItem[]);
        break;
      }
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    const updates = heroSlides.map((s) =>
      supabase.from('hero_slides').update({
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
      }).eq('id', s.id)
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) toast.error('일부 슬라이드 저장 실패');
    else toast.success('전체 슬라이드 저장 완료');
    setSaving(false);
  };

  const updateHeroSlide = (id: string, field: keyof HeroSlide, value: string | null) => {
    setHeroSlides((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSaveServices = async () => {
    setSaving(true);
    let hasError = false;
    if (servicesSection) {
      const { error } = await supabase.from('landing_sections').update({
        title: servicesSection.title,
        subtitle: servicesSection.subtitle,
        description: servicesSection.description,
      }).eq('id', servicesSection.id);
      if (error) hasError = true;
    }
    for (let idx = 0; idx < serviceItems.length; idx++) {
      const { error } = await supabase.from('service_items').upsert({
        ...serviceItems[idx],
        order_index: idx,
      });
      if (error) hasError = true;
    }
    if (hasError) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const addServiceItem = () => {
    const newItem: ServiceItem = {
      id: crypto.randomUUID(),
      icon_key: 'star',
      icon_svg: null,
      title: '새 서비스',
      description: '설명을 입력하세요',
      is_visible: true,
      order_index: serviceItems.length,
      is_seed: false,
      updated_at: new Date().toISOString(),
    };
    setServiceItems((prev) => [...prev, newItem]);
  };

  const updateServiceItem = (id: string, field: keyof ServiceItem, value: string | boolean) => {
    setServiceItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSaveSignage = async () => {
    setSaving(true);
    const updates = signageTypes.map((item, idx) =>
      supabase.from('signage_types').upsert({ ...item, order_index: idx })
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const updateSignageType = (id: string, field: keyof SignageType, value: string | boolean) => {
    setSignageTypes((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSaveClients = async () => {
    setSaving(true);
    const projUpdates = clientProjects.map((item, idx) =>
      supabase.from('client_projects').upsert({ ...item, order_index: idx })
    );
    const tabUpdates = filterTabs.map((tab, idx) =>
      supabase.from('project_filter_tabs').upsert({ ...tab, order_index: idx })
    );
    const results = await Promise.all([...projUpdates, ...tabUpdates]);
    if (results.some((r) => r.error)) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const updateClientProject = (id: string, field: keyof ClientProject, value: string | boolean) => {
    setClientProjects((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
  };

  const addClientProject = () => {
    const newItem: ClientProject = {
      id: crypto.randomUUID(),
      category: 'restaurant',
      name: '새 프로젝트',
      project_type: '',
      image_url: '',
      is_visible: true,
      order_index: clientProjects.length,
      is_seed: false,
      updated_at: new Date().toISOString(),
    };
    setClientProjects((prev) => [...prev, newItem]);
  };

  const handleSaveFaqs = async () => {
    setSaving(true);
    const updates = faqs.map((faq, idx) =>
      supabase.from('landing_faqs').upsert({ ...faq, order_index: idx })
    );
    const results = await Promise.all(updates);
    if (results.some((r) => r.error)) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const updateFaq = (id: string, field: keyof LandingFaq, value: string | boolean) => {
    setFaqs((prev) => prev.map((faq) => faq.id === id ? { ...faq, [field]: value } : faq));
  };

  const addFaq = () => {
    const newFaq: LandingFaq = {
      id: crypto.randomUUID(),
      question: '새 질문',
      answer: '답변을 입력하세요',
      is_visible: true,
      order_index: faqs.length,
      is_seed: false,
      updated_at: new Date().toISOString(),
    };
    setFaqs((prev) => [...prev, newFaq]);
  };

  const handleSaveContact = async () => {
    setSaving(true);
    let hasError = false;
    if (contactSection) {
      const { error } = await supabase.from('landing_sections').update({
        title: contactSection.title,
        subtitle: contactSection.subtitle,
        description: contactSection.description,
      }).eq('id', contactSection.id);
      if (error) hasError = true;
    }
    for (let idx = 0; idx < inquiryTypes.length; idx++) {
      const { error } = await supabase.from('inquiry_types').upsert({
        ...inquiryTypes[idx],
        order_index: idx,
      });
      if (error) hasError = true;
    }
    if (hasError) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const updateInquiryType = (id: string, field: keyof InquiryType, value: string | boolean) => {
    setInquiryTypes((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSaveFooter = async () => {
    setSaving(true);
    const configUpdates = footerConfigs.map((c) =>
      supabase.from('site_config').update({ value: c.value }).eq('id', c.id)
    );
    const quickUpdates = footerQuickNav.map((n, idx) =>
      supabase.from('navigation_items').upsert({ ...n, order_index: idx })
    );
    const serviceUpdates = footerServiceNav.map((n, idx) =>
      supabase.from('navigation_items').upsert({ ...n, order_index: idx })
    );
    const results = await Promise.all([...configUpdates, ...quickUpdates, ...serviceUpdates]);
    if (results.some((r) => r.error)) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const updateFooterConfig = (id: string, value: string) => {
    setFooterConfigs((prev) => prev.map((c) => c.id === id ? { ...c, value } : c));
  };

  const updateNavItem = (type: 'quick' | 'service', id: string, field: keyof NavigationItem, value: string | boolean) => {
    const setter = type === 'quick' ? setFooterQuickNav : setFooterServiceNav;
    setter((prev) => prev.map((n) => n.id === id ? { ...n, [field]: value } : n));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { table, id } = deleteTarget;
    let error: unknown = null;
    if (table === 'service_items') {
      const res = await supabase.from('service_items').delete().eq('id', id);
      error = res.error;
    } else if (table === 'client_projects') {
      const res = await supabase.from('client_projects').delete().eq('id', id);
      error = res.error;
    } else if (table === 'landing_faqs') {
      const res = await supabase.from('landing_faqs').delete().eq('id', id);
      error = res.error;
    }
    if (error) toast.error('삭제 실패');
    else {
      toast.success('삭제 완료');
      fetchData();
    }
    setDeleteTarget(null);
  };

  const renderHeroTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">Hero 슬라이드</h2>
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveAllHero}>
          <Save size={16} /> 전체 저장
        </button>
      </div>
      {heroSlides.map((slide) => (
        <div key={slide.id} className="admin-card">
          <div
            className="admin-card-header"
            onClick={() => setExpandedSlide(expandedSlide === slide.id ? null : slide.id)}
          >
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

  const renderServicesTab = () => (
    <div>
      {servicesSection && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">섹션 헤더</h2>
          </div>
          <div className="admin-card-body">
            <FormField label="제목">
              <input className="admin-input" value={servicesSection.title ?? ''} onChange={(e) => setServicesSection({ ...servicesSection, title: e.target.value })} />
            </FormField>
            <FormField label="부제">
              <input className="admin-input" value={servicesSection.subtitle ?? ''} onChange={(e) => setServicesSection({ ...servicesSection, subtitle: e.target.value })} />
            </FormField>
            <FormField label="설명">
              <textarea className="admin-textarea" value={servicesSection.description ?? ''} onChange={(e) => setServicesSection({ ...servicesSection, description: e.target.value })} />
            </FormField>
          </div>
        </div>
      )}
      <div className="admin-card-header">
        <h2 className="admin-card-title">서비스 항목</h2>
        <button className="admin-btn admin-btn-secondary" onClick={addServiceItem}>
          <Plus size={16} /> 추가
        </button>
      </div>
      <DragSortList
        items={serviceItems}
        keyExtractor={(item) => item.id}
        onReorder={setServiceItems}
        renderItem={(item) => (
          <div className="admin-drag-item-content">
            <div className="admin-form-group">
              <input className="admin-input" value={item.icon_key} placeholder="아이콘 키" onChange={(e) => updateServiceItem(item.id, 'icon_key', e.target.value)} />
              <input className="admin-input" value={item.title} placeholder="제목" onChange={(e) => updateServiceItem(item.id, 'title', e.target.value)} />
              <input className="admin-input" value={item.description} placeholder="설명" onChange={(e) => updateServiceItem(item.id, 'description', e.target.value)} />
            </div>
            <Toggle checked={item.is_visible} onChange={(v) => updateServiceItem(item.id, 'is_visible', v)} label="표시" />
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteTarget({ table: 'service_items', id: item.id })}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      />
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveServices}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderSignageTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">간판 종류</h2>
      </div>
      <DragSortList
        items={signageTypes}
        keyExtractor={(item) => item.id}
        onReorder={setSignageTypes}
        renderItem={(item) => (
          <div className="admin-drag-item-content">
            <div className="admin-form-group">
              <input className="admin-input" value={item.number_label} placeholder="번호" onChange={(e) => updateSignageType(item.id, 'number_label', e.target.value)} />
              <input className="admin-input" value={item.title} placeholder="제목" onChange={(e) => updateSignageType(item.id, 'title', e.target.value)} />
              <input className="admin-input" value={item.description} placeholder="설명" onChange={(e) => updateSignageType(item.id, 'description', e.target.value)} />
              <input className="admin-input" value={item.link} placeholder="링크" onChange={(e) => updateSignageType(item.id, 'link', e.target.value)} />
              <input className="admin-input" value={item.image_url} placeholder="이미지 URL" onChange={(e) => updateSignageType(item.id, 'image_url', e.target.value)} />
            </div>
            <Toggle checked={item.is_visible} onChange={(v) => updateSignageType(item.id, 'is_visible', v)} label="표시" />
          </div>
        )}
      />
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveSignage}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderClientsTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">필터 탭</h2>
      </div>
      <DragSortList
        items={filterTabs}
        keyExtractor={(tab) => tab.id}
        onReorder={setFilterTabs}
        renderItem={(tab) => (
          <div className="admin-drag-item-content">
            <input className="admin-input" value={tab.tab_key} placeholder="키" onChange={(e) => setFilterTabs((prev) => prev.map((t) => t.id === tab.id ? { ...t, tab_key: e.target.value } : t))} />
            <input className="admin-input" value={tab.label} placeholder="라벨" onChange={(e) => setFilterTabs((prev) => prev.map((t) => t.id === tab.id ? { ...t, label: e.target.value } : t))} />
            <Toggle checked={tab.is_visible} onChange={(v) => setFilterTabs((prev) => prev.map((t) => t.id === tab.id ? { ...t, is_visible: v } : t))} label="표시" />
          </div>
        )}
      />
      <div className="admin-card-header">
        <h2 className="admin-card-title">프로젝트</h2>
        <button className="admin-btn admin-btn-secondary" onClick={addClientProject}>
          <Plus size={16} /> 추가
        </button>
      </div>
      <DragSortList
        items={clientProjects}
        keyExtractor={(item) => item.id}
        onReorder={setClientProjects}
        renderItem={(item) => (
          <div className="admin-drag-item-content">
            <div className="admin-form-group">
              <select className="admin-select" value={item.category} onChange={(e) => updateClientProject(item.id, 'category', e.target.value)}>
                {CLIENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="admin-input" value={item.name} placeholder="이름" onChange={(e) => updateClientProject(item.id, 'name', e.target.value)} />
              <input className="admin-input" value={item.project_type} placeholder="프로젝트 유형" onChange={(e) => updateClientProject(item.id, 'project_type', e.target.value)} />
              <input className="admin-input" value={item.image_url} placeholder="이미지 URL" onChange={(e) => updateClientProject(item.id, 'image_url', e.target.value)} />
            </div>
            <Toggle checked={item.is_visible} onChange={(v) => updateClientProject(item.id, 'is_visible', v)} label="표시" />
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteTarget({ table: 'client_projects', id: item.id })}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      />
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveClients}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderFaqTab = () => (
    <div>
      <div className="admin-card-header">
        <h2 className="admin-card-title">자주 묻는 질문</h2>
        <button className="admin-btn admin-btn-secondary" onClick={addFaq}>
          <Plus size={16} /> 추가
        </button>
      </div>
      <DragSortList
        items={faqs}
        keyExtractor={(faq) => faq.id}
        onReorder={setFaqs}
        renderItem={(faq) => (
          <div className="admin-drag-item-content">
            <div className="admin-form-group">
              <textarea className="admin-textarea" value={faq.question} placeholder="질문" onChange={(e) => updateFaq(faq.id, 'question', e.target.value)} />
              <textarea className="admin-textarea" value={faq.answer} placeholder="답변" onChange={(e) => updateFaq(faq.id, 'answer', e.target.value)} />
            </div>
            <Toggle checked={faq.is_visible} onChange={(v) => updateFaq(faq.id, 'is_visible', v)} label="표시" />
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setDeleteTarget({ table: 'landing_faqs', id: faq.id })}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
      />
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveFaqs}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderContactTab = () => (
    <div>
      {contactSection && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">섹션 헤더</h2>
          </div>
          <div className="admin-card-body">
            <FormField label="제목">
              <input className="admin-input" value={contactSection.title ?? ''} onChange={(e) => setContactSection({ ...contactSection, title: e.target.value })} />
            </FormField>
            <FormField label="부제">
              <input className="admin-input" value={contactSection.subtitle ?? ''} onChange={(e) => setContactSection({ ...contactSection, subtitle: e.target.value })} />
            </FormField>
            <FormField label="설명">
              <textarea className="admin-textarea" value={contactSection.description ?? ''} onChange={(e) => setContactSection({ ...contactSection, description: e.target.value })} />
            </FormField>
          </div>
        </div>
      )}
      <div className="admin-card-header">
        <h2 className="admin-card-title">문의 유형</h2>
      </div>
      <DragSortList
        items={inquiryTypes}
        keyExtractor={(t) => t.id}
        onReorder={setInquiryTypes}
        renderItem={(t) => (
          <div className="admin-drag-item-content">
            <input className="admin-input" value={t.label} placeholder="라벨" onChange={(e) => updateInquiryType(t.id, 'label', e.target.value)} />
            <input className="admin-input" value={t.value} placeholder="값" onChange={(e) => updateInquiryType(t.id, 'value', e.target.value)} />
            <Toggle checked={t.is_visible} onChange={(v) => updateInquiryType(t.id, 'is_visible', v)} label="표시" />
          </div>
        )}
      />
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveContact}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderFooterTab = () => (
    <div>
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">푸터 설정</h2>
        </div>
        <div className="admin-card-body">
          {footerConfigs.map((config) => (
            <FormField key={config.id} label={config.description ?? config.key}>
              <input className="admin-input" value={config.value} onChange={(e) => updateFooterConfig(config.id, e.target.value)} />
            </FormField>
          ))}
        </div>
      </div>
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">빠른 링크</h2>
        </div>
        <DragSortList
          items={footerQuickNav}
          keyExtractor={(n) => n.id}
          onReorder={setFooterQuickNav}
          renderItem={(n) => (
            <div className="admin-drag-item-content">
              <input className="admin-input" value={n.label} placeholder="라벨" onChange={(e) => updateNavItem('quick', n.id, 'label', e.target.value)} />
              <input className="admin-input" value={n.href} placeholder="링크" onChange={(e) => updateNavItem('quick', n.id, 'href', e.target.value)} />
              <Toggle checked={n.is_visible} onChange={(v) => updateNavItem('quick', n.id, 'is_visible', v)} label="표시" />
            </div>
          )}
        />
      </div>
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">서비스 링크</h2>
        </div>
        <DragSortList
          items={footerServiceNav}
          keyExtractor={(n) => n.id}
          onReorder={setFooterServiceNav}
          renderItem={(n) => (
            <div className="admin-drag-item-content">
              <input className="admin-input" value={n.label} placeholder="라벨" onChange={(e) => updateNavItem('service', n.id, 'label', e.target.value)} />
              <input className="admin-input" value={n.href} placeholder="링크" onChange={(e) => updateNavItem('service', n.id, 'href', e.target.value)} />
              <Toggle checked={n.is_visible} onChange={(v) => updateNavItem('service', n.id, 'is_visible', v)} label="표시" />
            </div>
          )}
        />
      </div>
      <div className="admin-card-body">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSaveFooter}>
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );

  const renderTabContent = () => {
    if (loading) return <LoadingSpinner size="lg" />;
    switch (activeTab) {
      case 'hero': return renderHeroTab();
      case 'services': return renderServicesTab();
      case 'signage': return renderSignageTab();
      case 'clients': return renderClientsTab();
      case 'faq': return renderFaqTab();
      case 'contact': return renderContactTab();
      case 'footer': return renderFooterTab();
      default: return null;
    }
  };

  return (
    <div className="admin-page">
      <h1 className="admin-card-title">랜딩 페이지 관리</h1>
      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {renderTabContent()}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="삭제 확인"
        message="정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
