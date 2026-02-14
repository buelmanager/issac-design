import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { AboutSection } from '../../../types/admin';
import type { Json } from '../../../types/database';
import { FormField, TabNav, LoadingSpinner, LinkSelect } from '../ui';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

const TABS = [
  { key: 'hero', label: 'Hero' },
  { key: 'mission', label: 'Mission' },
  { key: 'values', label: 'Values' },
  { key: 'story', label: 'Story' },
  { key: 'office', label: 'Office' },
  { key: 'stats', label: 'Stats' },
  { key: 'cta', label: 'CTA' },
];

interface CardItem {
  icon: string;
  title: string;
  desc: string;
}

interface StatCard {
  number: string;
  label: string;
  desc: string;
}

interface ImageItem {
  label: string;
  url: string;
}

interface ButtonItem {
  text: string;
  href: string;
}

function getStr(content: Record<string, Json | undefined>, key: string): string {
  const val = content[key];
  return typeof val === 'string' ? val : '';
}

function getArr<T>(content: Record<string, Json | undefined>, key: string): T[] {
  const val = content[key];
  return Array.isArray(val) ? val as T[] : [];
}

function getObj<T>(content: Record<string, Json | undefined>, key: string): T {
  const val = content[key];
  return (val && typeof val === 'object' && !Array.isArray(val)) ? val as T : {} as T;
}

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState('hero');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<AboutSection | null>(null);
  const [content, setContent] = useState<Record<string, Json | undefined>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('about_sections').select('*').eq('section_key', activeTab).single();
    const sec = (data ?? null) as AboutSection | null;
    setSection(sec);
    if (sec && sec.content && typeof sec.content === 'object' && !Array.isArray(sec.content)) {
      setContent(sec.content as Record<string, Json | undefined>);
    } else {
      setContent({});
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateField = (key: string, value: Json) => {
    setContent((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!section) return;
    setSaving(true);
    const { error } = await supabase.from('about_sections').update({
      content: content as Json,
    }).eq('id', section.id);
    if (error) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
  };

  const renderHeroFields = () => (
    <>
      <FormField label="라벨">
        <input className="admin-input" value={getStr(content, 'label')} onChange={(e) => updateField('label', e.target.value)} />
      </FormField>
      <FormField label="제목">
        <input className="admin-input" value={getStr(content, 'title')} onChange={(e) => updateField('title', e.target.value)} />
      </FormField>
      <FormField label="부제">
        <input className="admin-input" value={getStr(content, 'subtitle')} onChange={(e) => updateField('subtitle', e.target.value)} />
      </FormField>
    </>
  );

  const renderMissionFields = () => (
    <>
      <FormField label="인용문">
        <textarea className="admin-textarea" value={getStr(content, 'quote')} onChange={(e) => updateField('quote', e.target.value)} />
      </FormField>
      <FormField label="부제">
        <input className="admin-input" value={getStr(content, 'subtitle')} onChange={(e) => updateField('subtitle', e.target.value)} />
      </FormField>
    </>
  );

  const renderValuesFields = () => {
    const cards = getArr<CardItem>(content, 'cards');
    const updateCard = (idx: number, field: keyof CardItem, value: string) => {
      const updated = cards.map((c, i) => i === idx ? { ...c, [field]: value } : c);
      updateField('cards', updated as unknown as Json);
    };
    const addCard = () => {
      updateField('cards', [...cards, { icon: '', title: '', desc: '' }] as unknown as Json);
    };
    const removeCard = (idx: number) => {
      updateField('cards', cards.filter((_, i) => i !== idx) as unknown as Json);
    };
    return (
      <>
        {cards.map((card, idx) => (
          <div key={idx} className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">카드 {idx + 1}</h3>
              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeCard(idx)}>
                <Trash2 size={14} />
              </button>
            </div>
            <div className="admin-card-body">
              <FormField label="아이콘">
                <input className="admin-input" value={card.icon} onChange={(e) => updateCard(idx, 'icon', e.target.value)} />
              </FormField>
              <FormField label="제목">
                <input className="admin-input" value={card.title} onChange={(e) => updateCard(idx, 'title', e.target.value)} />
              </FormField>
              <FormField label="설명">
                <textarea className="admin-textarea" value={card.desc} onChange={(e) => updateCard(idx, 'desc', e.target.value)} />
              </FormField>
            </div>
          </div>
        ))}
        <button className="admin-btn admin-btn-secondary" onClick={addCard}>
          <Plus size={16} /> 카드 추가
        </button>
      </>
    );
  };

  const renderStoryFields = () => {
    const paragraphs = getArr<string>(content, 'paragraphs');
    const updateParagraph = (idx: number, value: string) => {
      const updated = paragraphs.map((p, i) => i === idx ? value : p);
      updateField('paragraphs', updated as Json);
    };
    const addParagraph = () => {
      updateField('paragraphs', [...paragraphs, ''] as Json);
    };
    const removeParagraph = (idx: number) => {
      updateField('paragraphs', paragraphs.filter((_, i) => i !== idx) as Json);
    };
    return (
      <>
        <FormField label="라벨">
          <input className="admin-input" value={getStr(content, 'label')} onChange={(e) => updateField('label', e.target.value)} />
        </FormField>
        <FormField label="제목">
          <input className="admin-input" value={getStr(content, 'title')} onChange={(e) => updateField('title', e.target.value)} />
        </FormField>
        <h3 className="admin-card-title">문단</h3>
        {paragraphs.map((p, idx) => (
          <div key={idx} className="admin-form-group">
            <FormField label={`문단 ${idx + 1}`}>
              <textarea className="admin-textarea" value={p} onChange={(e) => updateParagraph(idx, e.target.value)} />
            </FormField>
            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeParagraph(idx)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button className="admin-btn admin-btn-secondary" onClick={addParagraph}>
          <Plus size={16} /> 문단 추가
        </button>
      </>
    );
  };

  const renderOfficeFields = () => {
    const images = getArr<ImageItem>(content, 'images');
    const updateImage = (idx: number, field: keyof ImageItem, value: string) => {
      const updated = images.map((img, i) => i === idx ? { ...img, [field]: value } : img);
      updateField('images', updated as unknown as Json);
    };
    const addImage = () => {
      updateField('images', [...images, { label: '', url: '' }] as unknown as Json);
    };
    const removeImage = (idx: number) => {
      updateField('images', images.filter((_, i) => i !== idx) as unknown as Json);
    };
    return (
      <>
        <FormField label="라벨">
          <input className="admin-input" value={getStr(content, 'label')} onChange={(e) => updateField('label', e.target.value)} />
        </FormField>
        <FormField label="제목">
          <input className="admin-input" value={getStr(content, 'title')} onChange={(e) => updateField('title', e.target.value)} />
        </FormField>
        <FormField label="설명">
          <textarea className="admin-textarea" value={getStr(content, 'description')} onChange={(e) => updateField('description', e.target.value)} />
        </FormField>
        <FormField label="부속 텍스트">
          <input className="admin-input" value={getStr(content, 'sub')} onChange={(e) => updateField('sub', e.target.value)} />
        </FormField>
        <h3 className="admin-card-title">이미지</h3>
        {images.map((img, idx) => (
          <div key={idx} className="admin-card">
            <div className="admin-card-header">
              <h4 className="admin-card-title">이미지 {idx + 1}</h4>
              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeImage(idx)}>
                <Trash2 size={14} />
              </button>
            </div>
            <div className="admin-card-body">
              <FormField label="라벨">
                <input className="admin-input" value={img.label} onChange={(e) => updateImage(idx, 'label', e.target.value)} />
              </FormField>
              <FormField label="URL">
                <input className="admin-input" value={img.url} onChange={(e) => updateImage(idx, 'url', e.target.value)} />
              </FormField>
            </div>
          </div>
        ))}
        <button className="admin-btn admin-btn-secondary" onClick={addImage}>
          <Plus size={16} /> 이미지 추가
        </button>
      </>
    );
  };

  const renderStatsFields = () => {
    const cards = getArr<StatCard>(content, 'cards');
    const updateCard = (idx: number, field: keyof StatCard, value: string) => {
      const updated = cards.map((c, i) => i === idx ? { ...c, [field]: value } : c);
      updateField('cards', updated as unknown as Json);
    };
    return (
      <>
        {cards.map((card, idx) => (
          <div key={idx} className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">통계 {idx + 1}</h3>
            </div>
            <div className="admin-card-body">
              <FormField label="숫자">
                <input className="admin-input" value={card.number} onChange={(e) => updateCard(idx, 'number', e.target.value)} />
              </FormField>
              <FormField label="라벨">
                <input className="admin-input" value={card.label} onChange={(e) => updateCard(idx, 'label', e.target.value)} />
              </FormField>
              <FormField label="설명">
                <input className="admin-input" value={card.desc} onChange={(e) => updateCard(idx, 'desc', e.target.value)} />
              </FormField>
            </div>
          </div>
        ))}
      </>
    );
  };

  const renderCtaFields = () => {
    const button1 = getObj<ButtonItem>(content, 'button1');
    const button2 = getObj<ButtonItem>(content, 'button2');
    const updateButton = (key: 'button1' | 'button2', field: keyof ButtonItem, value: string) => {
      const btn = key === 'button1' ? button1 : button2;
      updateField(key, { ...btn, [field]: value } as unknown as Json);
    };
    return (
      <>
        <FormField label="제목">
          <input className="admin-input" value={getStr(content, 'title')} onChange={(e) => updateField('title', e.target.value)} />
        </FormField>
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">버튼 1</h3>
          </div>
          <div className="admin-card-body">
            <FormField label="텍스트">
              <input className="admin-input" value={button1.text ?? ''} onChange={(e) => updateButton('button1', 'text', e.target.value)} />
            </FormField>
            <FormField label="링크">
              <LinkSelect value={button1.href ?? ''} onChange={(v) => updateButton('button1', 'href', v)} />
            </FormField>
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">버튼 2</h3>
          </div>
          <div className="admin-card-body">
            <FormField label="텍스트">
              <input className="admin-input" value={button2.text ?? ''} onChange={(e) => updateButton('button2', 'text', e.target.value)} />
            </FormField>
            <FormField label="링크">
              <LinkSelect value={button2.href ?? ''} onChange={(v) => updateButton('button2', 'href', v)} />
            </FormField>
          </div>
        </div>
      </>
    );
  };

  const renderTabContent = () => {
    if (loading) return <LoadingSpinner size="lg" />;
    if (!section) return <p className="admin-empty-text">섹션 데이터가 없습니다.</p>;

    let fields = null;
    switch (activeTab) {
      case 'hero': fields = renderHeroFields(); break;
      case 'mission': fields = renderMissionFields(); break;
      case 'values': fields = renderValuesFields(); break;
      case 'story': fields = renderStoryFields(); break;
      case 'office': fields = renderOfficeFields(); break;
      case 'stats': fields = renderStatsFields(); break;
      case 'cta': fields = renderCtaFields(); break;
    }

    return (
      <div className="admin-card">
        <div className="admin-card-body">
          {fields}
          <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSave}>
            <Save size={16} /> 저장
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-page">
      <h1 className="admin-card-title">회사소개 페이지 관리</h1>
      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      {renderTabContent()}
    </div>
  );
}
