import { useState, useEffect, useCallback } from 'react';
import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { SiteConfig } from '../../../types/admin';
import { TabNav, FormField, LoadingSpinner } from '../ui';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'company', label: '회사 정보' },
  { key: 'contact', label: '연락처' },
  { key: 'hours', label: '운영시간' },
  { key: 'social', label: 'SNS' },
];

const KEY_LABELS: Record<string, string> = {
  badge: '뱃지',
  business_number: '사업자등록번호',
  name: '회사명',
  tagline: '태그라인',
  tagline_sub: '태그라인 부제',
  address: '주소',
  phone: '전화번호',
  fax: '팩스',
  email: '이메일',
  ceo: '대표자',
  weekday_hours: '평일 운영시간',
  weekend_hours: '주말 운영시간',
  holiday_hours: '공휴일 운영시간',
  lunch_hours: '점심시간',
  instagram: '인스타그램',
  youtube: '유튜브',
  blog: '블로그',
  kakao: '카카오톡',
  naver_map: '네이버 지도',
  copyright: '저작권 표시',
  directions: '오시는 길',
  kakao_url: '카카오톡 URL',
  map_lat: '지도 위도',
  map_lng: '지도 경도',
  website: '웹사이트',
};

export default function SiteSettingsPage() {
  const [configs, setConfigs] = useState<SiteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('company');
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase.from('site_config').select('*').order('key');
    if (error) {
      toast.error('설정 로드 실패');
      setLoading(false);
      return;
    }
    const list: SiteConfig[] = (rows ?? []) as SiteConfig[];
    setConfigs(list);
    const values: Record<string, string> = {};
    for (const c of list) {
      values[c.id] = c.value;
    }
    setEditValues(values);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredConfigs = configs.filter((c) => c.category === activeTab);

  function handleValueChange(id: string, value: string) {
    setEditValues((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSave() {
    setSaving(true);
    const updates = filteredConfigs.map((c) =>
      supabase
        .from('site_config')
        .update({ value: editValues[c.id] ?? c.value, updated_at: new Date().toISOString() })
        .eq('id', c.id)
    );

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    if (hasError) {
      toast.error('일부 설정 저장 실패');
    } else {
      toast.success('설정이 저장되었습니다');
    }
    setSaving(false);
  }

  function renderInput(config: SiteConfig) {
    const value = editValues[config.id] ?? config.value;

    if (config.value_type === 'textarea') {
      return (
        <textarea
          className="admin-textarea"
          value={value}
          onChange={(e) => handleValueChange(config.id, e.target.value)}
          rows={3}
        />
      );
    }

    if (config.value_type === 'boolean') {
      return (
        <select
          className="admin-select"
          value={value}
          onChange={(e) => handleValueChange(config.id, e.target.value)}
        >
          <option value="true">예</option>
          <option value="false">아니오</option>
        </select>
      );
    }

    return (
      <input
        className="admin-input"
        type={config.value_type === 'url' ? 'url' : 'text'}
        value={value}
        onChange={(e) => handleValueChange(config.id, e.target.value)}
      />
    );
  }

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">사이트 설정</h1>
          <p className="settings-page-subtitle">회사 정보, 연락처, 운영시간, SNS 설정을 관리합니다</p>
        </div>
      </div>

      <TabNav tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="admin-card">
        {filteredConfigs.length === 0 ? (
          <p className="admin-empty-text">이 카테고리에 설정이 없습니다</p>
        ) : (
          <div className="admin-form">
            {filteredConfigs.map((config) => (
              <FormField
                key={config.id}
                label={config.description ?? KEY_LABELS[config.key] ?? config.key}
                htmlFor={`config-${config.id}`}
              >
                {renderInput(config)}
              </FormField>
            ))}
          </div>
        )}

        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={saving || filteredConfigs.length === 0}
          >
            <Save size={16} />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
