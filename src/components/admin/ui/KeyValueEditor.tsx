import { useState, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { Plus, X } from 'lucide-react';

interface KeyValueEditorProps {
  entries: Record<string, string>;
  onChange: (entries: Record<string, string>) => void;
  keyLabel?: string;
  valueLabel?: string;
  valueType?: 'text' | 'image';
  folder?: string;
}

interface KVItem {
  id: string;
  key: string;
  value: string;
}

let kvId = 1;
function makeKVId() {
  return `kv-${kvId++}-${Date.now()}`;
}

function toKVItems(entries: Record<string, string>): KVItem[] {
  return Object.entries(entries).map(([key, value]) => ({
    id: makeKVId(),
    key,
    value,
  }));
}

function fromKVItems(items: KVItem[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of items) {
    if (item.key.trim()) {
      result[item.key.trim()] = item.value;
    }
  }
  return result;
}

export function KeyValueEditor({
  entries,
  onChange,
  keyLabel = '키',
  valueLabel = '값',
  valueType = 'text',
  folder = 'products',
}: KeyValueEditorProps) {
  const [items, setItems] = useState<KVItem[]>(() => toKVItems(entries));

  const sync = useCallback((newItems: KVItem[]) => {
    setItems(newItems);
    onChange(fromKVItems(newItems));
  }, [onChange]);

  const handleAdd = useCallback(() => {
    sync([...items, { id: makeKVId(), key: '', value: '' }]);
  }, [items, sync]);

  const handleRemove = useCallback((id: string) => {
    sync(items.filter((i) => i.id !== id));
  }, [items, sync]);

  const handleKeyChange = useCallback((id: string, key: string) => {
    sync(items.map((i) => (i.id === id ? { ...i, key } : i)));
  }, [items, sync]);

  const handleValueChange = useCallback((id: string, value: string) => {
    sync(items.map((i) => (i.id === id ? { ...i, value } : i)));
  }, [items, sync]);

  return (
    <div className="kv-editor">
      {items.length > 0 && (
        <div className="kv-editor-header">
          <span className="kv-editor-col-label">{keyLabel}</span>
          <span className="kv-editor-col-label">{valueLabel}</span>
          <span className="kv-editor-col-action" />
        </div>
      )}
      <div className="kv-editor-list">
        {items.map((item) => (
          <div key={item.id} className="kv-editor-row">
            <input
              className="admin-input"
              value={item.key}
              onChange={(e) => handleKeyChange(item.id, e.target.value)}
              placeholder={keyLabel}
            />
            {valueType === 'image' ? (
              <div className="kv-editor-image-cell">
                <ImageUploader
                  value={item.value}
                  onChange={(val) => handleValueChange(item.id, val)}
                  folder={folder}
                />
              </div>
            ) : (
              <input
                className="admin-input"
                value={item.value}
                onChange={(e) => handleValueChange(item.id, e.target.value)}
                placeholder={valueLabel}
              />
            )}
            <button type="button" className="admin-btn-icon admin-btn-icon-danger" onClick={() => handleRemove(item.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="admin-btn admin-btn-secondary" onClick={handleAdd}>
        <Plus size={14} /> 항목 추가
      </button>
    </div>
  );
}
