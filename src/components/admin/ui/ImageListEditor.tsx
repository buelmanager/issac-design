import { useState, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { DragSortList } from './DragSortList';
import { Plus, X, Pencil } from 'lucide-react';

interface ImageListEditorProps {
  images: string[];
  onChange: (images: string[]) => void;
  folder?: string;
}

interface ImageItem {
  id: string;
  url: string;
}

let nextId = 1;
function makeId() {
  return `img-${nextId++}-${Date.now()}`;
}

function toItems(urls: string[]): ImageItem[] {
  return urls.map((url) => ({ id: makeId(), url }));
}

export function ImageListEditor({ images, onChange, folder = 'products' }: ImageListEditorProps) {
  const [items, setItems] = useState<ImageItem[]>(() => toItems(images));
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const sync = useCallback((newItems: ImageItem[]) => {
    setItems(newItems);
    onChange(newItems.map((i) => i.url));
  }, [onChange]);

  const handleAdd = useCallback((url: string) => {
    if (!url) return;
    const newItems = [...items, { id: makeId(), url }];
    sync(newItems);
    setShowAdd(false);
  }, [items, sync]);

  const handleRemove = useCallback((id: string) => {
    sync(items.filter((i) => i.id !== id));
  }, [items, sync]);

  const handleEdit = useCallback((id: string, url: string) => {
    sync(items.map((i) => (i.id === id ? { ...i, url } : i)));
    setEditingId(null);
  }, [items, sync]);

  const handleReorder = useCallback((reordered: ImageItem[]) => {
    sync(reordered);
  }, [sync]);

  return (
    <div className="img-list-editor">
      {items.length > 0 && (
        <DragSortList
          items={items}
          keyExtractor={(item) => item.id}
          onReorder={handleReorder}
          renderItem={(item) => (
            <div className="img-list-item">
              {editingId === item.id ? (
                <div className="img-list-edit">
                  <ImageUploader
                    value={item.url}
                    onChange={(url) => handleEdit(item.id, url)}
                    folder={folder}
                  />
                </div>
              ) : (
                <>
                  {item.url && <img src={item.url} alt="" className="img-list-thumb" />}
                  <span className="img-list-url">{item.url}</span>
                  <button type="button" className="admin-btn-icon" onClick={() => setEditingId(item.id)}>
                    <Pencil size={14} />
                  </button>
                </>
              )}
              <button type="button" className="admin-btn-icon admin-btn-icon-danger" onClick={() => handleRemove(item.id)}>
                <X size={14} />
              </button>
            </div>
          )}
        />
      )}

      {showAdd ? (
        <div className="img-list-add-panel">
          <ImageUploader value="" onChange={handleAdd} folder={folder} />
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowAdd(false)}>
            취소
          </button>
        </div>
      ) : (
        <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> 이미지 추가
        </button>
      )}
    </div>
  );
}
