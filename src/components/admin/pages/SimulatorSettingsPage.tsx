import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { SimulatorConfig } from '../../../types/admin';
import type { Json } from '../../../types/database';
import { LoadingSpinner, ImageUploader } from '../ui';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Save } from 'lucide-react';

export default function SimulatorSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<SimulatorConfig[]>([]);

  const [bgImage, setBgImage] = useState('');
  const [defaultImage, setDefaultImage] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('simulator_config').select('*');
    const rows = (data ?? []) as SimulatorConfig[];
    setConfigs(rows);

    for (const row of rows) {
      if (row.key === 'background_image' && typeof row.value === 'string') {
        setBgImage(row.value);
      }
      if (row.key === 'default_image' && typeof row.value === 'string') {
        setDefaultImage(row.value);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const upsertConfig = async (key: string, value: Json): Promise<boolean> => {
    const existingId = configs.find((c) => c.key === key)?.id;
    if (existingId) {
      const { error } = await supabase.from('simulator_config').update({ value }).eq('id', existingId);
      return !error;
    }
    const { error } = await supabase.from('simulator_config').insert({ key, value });
    return !error;
  };

  const handleSave = async () => {
    setSaving(true);
    let hasError = false;

    if (!await upsertConfig('background_image', bgImage as unknown as Json)) hasError = true;
    if (!await upsertConfig('default_image', defaultImage as unknown as Json)) hasError = true;

    if (hasError) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
    fetchData();
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">시뮬레이터 설정</h1>
          <p className="settings-page-subtitle">시뮬레이터 배경 및 기본 간판 이미지를 관리합니다</p>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">배경 이미지</h2>
        </div>
        <div className="admin-card-body">
          <p className="admin-form-description">시뮬레이터의 기본 배경으로 사용될 이미지입니다.</p>
          <ImageUploader value={bgImage} onChange={setBgImage} folder="simulator" />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">기본 간판 이미지</h2>
        </div>
        <div className="admin-card-body">
          <p className="admin-form-description">시뮬레이터 진입 시 기본으로 표시될 간판 이미지입니다.</p>
          <ImageUploader value={defaultImage} onChange={setDefaultImage} folder="simulator" />
        </div>
      </div>

      <div className="admin-form-actions">
        <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSave}>
          <Save size={16} /> {saving ? '저장 중...' : '전체 저장'}
        </button>
      </div>
    </div>
  );
}
