import { useState, useCallback } from 'react';
import { ColorPicker } from './ColorPicker';
import { DragSortList } from './DragSortList';
import { Plus, X, ChevronDown, ChevronRight } from 'lucide-react';

interface SizeOption {
  label: string;
  priceModifier?: number;
}

interface MaterialOption {
  label: string;
  description?: string;
  priceModifier?: number;
}

interface FinishOption {
  label: string;
  colorHex?: string;
}

interface LightingOption {
  label: string;
  priceModifier?: number;
}

export interface OptionsData {
  sizes?: SizeOption[];
  materials?: MaterialOption[];
  finishes?: FinishOption[];
  lightingTypes?: LightingOption[];
}

interface OptionGroupEditorProps {
  options: OptionsData;
  onChange: (options: OptionsData) => void;
}

interface IdItem<T> {
  id: string;
  data: T;
}

let optId = 1;
function makeOptId() {
  return `opt-${optId++}-${Date.now()}`;
}

function wrapItems<T>(items: T[] | undefined): IdItem<T>[] {
  return (items ?? []).map((data) => ({ id: makeOptId(), data }));
}

function unwrapItems<T>(items: IdItem<T>[]): T[] {
  return items.map((i) => i.data);
}

type SectionKey = 'sizes' | 'materials' | 'finishes' | 'lightingTypes';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'sizes', label: '사이즈' },
  { key: 'materials', label: '소재' },
  { key: 'finishes', label: '마감' },
  { key: 'lightingTypes', label: '조명' },
];

export function OptionGroupEditor({ options, onChange }: OptionGroupEditorProps) {
  const [openSections, setOpenSections] = useState<Set<SectionKey>>(new Set(['sizes']));
  const [sizeItems, setSizeItems] = useState(() => wrapItems(options.sizes));
  const [materialItems, setMaterialItems] = useState(() => wrapItems(options.materials));
  const [finishItems, setFinishItems] = useState(() => wrapItems(options.finishes));
  const [lightingItems, setLightingItems] = useState(() => wrapItems(options.lightingTypes));

  const getState = useCallback((key: SectionKey) => {
    switch (key) {
      case 'sizes': return { items: sizeItems, setItems: setSizeItems };
      case 'materials': return { items: materialItems, setItems: setMaterialItems };
      case 'finishes': return { items: finishItems, setItems: setFinishItems };
      case 'lightingTypes': return { items: lightingItems, setItems: setLightingItems };
    }
  }, [sizeItems, materialItems, finishItems, lightingItems]);

  const emitChange = useCallback((key: SectionKey, newItems: IdItem<any>[]) => {
    const next = { ...options };
    switch (key) {
      case 'sizes': next.sizes = unwrapItems(newItems); break;
      case 'materials': next.materials = unwrapItems(newItems); break;
      case 'finishes': next.finishes = unwrapItems(newItems); break;
      case 'lightingTypes': next.lightingTypes = unwrapItems(newItems); break;
    }
    onChange(next);
  }, [options, onChange]);

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleAdd = useCallback((key: SectionKey) => {
    const { items, setItems } = getState(key);
    let newData: any;
    switch (key) {
      case 'sizes': newData = { label: '' }; break;
      case 'materials': newData = { label: '' }; break;
      case 'finishes': newData = { label: '', colorHex: '#000000' }; break;
      case 'lightingTypes': newData = { label: '' }; break;
    }
    const newItems = [...items, { id: makeOptId(), data: newData }];
    setItems(newItems);
    emitChange(key, newItems);
  }, [getState, emitChange]);

  const handleRemove = useCallback((key: SectionKey, id: string) => {
    const { items, setItems } = getState(key);
    const newItems = items.filter((i) => i.id !== id);
    setItems(newItems);
    emitChange(key, newItems);
  }, [getState, emitChange]);

  const handleUpdate = useCallback((key: SectionKey, id: string, field: string, value: any) => {
    const { items, setItems } = getState(key);
    const newItems = items.map((i) => {
      if (i.id !== id) return i;
      return { ...i, data: { ...i.data, [field]: value } };
    });
    setItems(newItems);
    emitChange(key, newItems);
  }, [getState, emitChange]);

  const handleReorder = useCallback((key: SectionKey, reordered: IdItem<any>[]) => {
    const { setItems } = getState(key);
    setItems(reordered);
    emitChange(key, reordered);
  }, [getState, emitChange]);

  return (
    <div className="option-group-editor">
      {SECTIONS.map(({ key, label }) => {
        const { items } = getState(key);
        const isOpen = openSections.has(key);
        return (
          <div key={key} className="option-section">
            <button type="button" className="option-section-header" onClick={() => toggleSection(key)}>
              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span>{label}</span>
              <span className="option-section-count">{items.length}</span>
            </button>
            {isOpen && (
              <div className="option-section-body">
                {items.length > 0 && (
                  <DragSortList
                    items={items}
                    keyExtractor={(i) => i.id}
                    onReorder={(reordered) => handleReorder(key, reordered)}
                    renderItem={(item) => (
                      <div className="option-item-fields">
                        <input
                          className="admin-input"
                          value={item.data.label}
                          onChange={(e) => handleUpdate(key, item.id, 'label', e.target.value)}
                          placeholder="이름"
                        />
                        {(key === 'sizes' || key === 'materials' || key === 'lightingTypes') && (
                          <input
                            className="admin-input"
                            type="number"
                            value={item.data.priceModifier ?? ''}
                            onChange={(e) => handleUpdate(key, item.id, 'priceModifier', e.target.value ? Number(e.target.value) : undefined)}
                            placeholder="가격 조정"
                            style={{ width: 120 }}
                          />
                        )}
                        {key === 'materials' && (
                          <input
                            className="admin-input"
                            value={item.data.description ?? ''}
                            onChange={(e) => handleUpdate(key, item.id, 'description', e.target.value)}
                            placeholder="설명"
                          />
                        )}
                        {key === 'finishes' && (
                          <ColorPicker
                            value={item.data.colorHex ?? '#000000'}
                            onChange={(color) => handleUpdate(key, item.id, 'colorHex', color)}
                          />
                        )}
                        <button type="button" className="admin-btn-icon admin-btn-icon-danger" onClick={() => handleRemove(key, item.id)}>
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  />
                )}
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleAdd(key)} style={{ marginTop: 8 }}>
                  <Plus size={14} /> 항목 추가
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
