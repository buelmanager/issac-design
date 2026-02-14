import { supabaseBrowser as supabase } from '../../../lib/supabase-browser';
import type { SimulatorConfig } from '../../../types/admin';
import type { Json } from '../../../types/database';
import { FormField, TagInput, ColorPicker, LoadingSpinner } from '../ui';
import toast from 'react-hot-toast';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';

export default function SimulatorSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<SimulatorConfig[]>([]);

  const [bgImages, setBgImages] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [fonts, setFonts] = useState<string[]>([]);
  const [materials, setMaterials] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('simulator_config').select('*');
    const rows = (data ?? []) as SimulatorConfig[];
    setConfigs(rows);

    for (const row of rows) {
      switch (row.key) {
        case 'background_images':
          setBgImages(Array.isArray(row.value) ? (row.value as string[]) : []);
          break;
        case 'color_palette':
          setColors(Array.isArray(row.value) ? (row.value as string[]) : []);
          break;
        case 'font_list':
          setFonts(Array.isArray(row.value) ? (row.value as string[]) : []);
          break;
        case 'material_options':
          setMaterials(JSON.stringify(row.value, null, 2));
          break;
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const findConfigId = (key: string): string | undefined => {
    return configs.find((c) => c.key === key)?.id;
  };

  const upsertConfig = async (key: string, value: Json): Promise<boolean> => {
    const existingId = findConfigId(key);
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

    if (!await upsertConfig('background_images', bgImages as unknown as Json)) hasError = true;
    if (!await upsertConfig('color_palette', colors as unknown as Json)) hasError = true;
    if (!await upsertConfig('font_list', fonts as unknown as Json)) hasError = true;

    try {
      const parsed = JSON.parse(materials);
      if (!await upsertConfig('material_options', parsed)) hasError = true;
    } catch {
      toast.error('Material Options JSON이 유효하지 않습니다');
      setSaving(false);
      return;
    }

    if (hasError) toast.error('저장 실패');
    else toast.success('저장 완료');
    setSaving(false);
    fetchData();
  };

  const updateBgImage = (idx: number, value: string) => {
    setBgImages((prev) => prev.map((v, i) => i === idx ? value : v));
  };

  const addBgImage = () => {
    setBgImages((prev) => [...prev, '']);
  };

  const removeBgImage = (idx: number) => {
    setBgImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const addColor = () => {
    setColors((prev) => [...prev, '#000000']);
  };

  const updateColor = (idx: number, value: string) => {
    setColors((prev) => prev.map((v, i) => i === idx ? value : v));
  };

  const removeColor = (idx: number) => {
    setColors((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="admin-page">
      <h1 className="admin-card-title">시뮬레이터 설정</h1>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">배경 이미지</h2>
          <button className="admin-btn admin-btn-secondary" onClick={addBgImage}>
            <Plus size={16} /> 추가
          </button>
        </div>
        <div className="admin-card-body">
          {bgImages.map((url, idx) => (
            <div key={idx} className="admin-form-group">
              <FormField label={`이미지 ${idx + 1}`}>
                <input className="admin-input" value={url} placeholder="이미지 URL" onChange={(e) => updateBgImage(idx, e.target.value)} />
              </FormField>
              <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeBgImage(idx)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {bgImages.length === 0 && <p className="admin-empty-text">배경 이미지가 없습니다.</p>}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">색상 팔레트</h2>
          <button className="admin-btn admin-btn-secondary" onClick={addColor}>
            <Plus size={16} /> 추가
          </button>
        </div>
        <div className="admin-card-body">
          <div className="admin-color-presets">
            {colors.map((color, idx) => (
              <div key={idx} className="admin-form-group">
                <ColorPicker value={color} onChange={(v) => updateColor(idx, v)} />
                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => removeColor(idx)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          {colors.length === 0 && <p className="admin-empty-text">색상이 없습니다.</p>}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">폰트 목록</h2>
        </div>
        <div className="admin-card-body">
          <TagInput tags={fonts} onChange={setFonts} placeholder="폰트 이름 입력 후 Enter..." />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">Material Options</h2>
        </div>
        <div className="admin-card-body">
          <FormField label="JSON 데이터">
            <textarea className="admin-textarea" value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </FormField>
        </div>
      </div>

      <button className="admin-btn admin-btn-primary" disabled={saving} onClick={handleSave}>
        <Save size={16} /> 전체 저장
      </button>
    </div>
  );
}
