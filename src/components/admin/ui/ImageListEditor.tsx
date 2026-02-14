import { useState, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { DragSortList } from './DragSortList';
import { Plus, X, Pencil, ImageOff } from 'lucide-react';

interface ImageListEditorProps {
  images: string[];
  onChange: (images: string[]) => void;
  folder?: string;
}

interface ImageItem {
  id: string;
  url: string;
}

function makeId(): string {
  return crypto.randomUUID();
}

function toItems(urls: string[]): ImageItem[] {
  return urls.map((url) => ({ id: makeId(), url }));
}

export function ImageListEditor({ images, onChange, folder = 'products' }: ImageListEditorProps) {
  const [items, setItems] = useState<ImageItem[]>(() => toItems(images));
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());

  const syncItems = useCallback((updater: (prev: ImageItem[]) => ImageItem[]) => {
    setItems((prev) => {
      const next = updater(prev);
      onChange(next.map((i) => i.url));
      return next;
    });
  }, [onChange]);

  const handleAdd = useCallback((url: string) => {
    if (!url) return;
    syncItems((prev) => [...prev, { id: makeId(), url }]);
    setShowAdd(false);
  }, [syncItems]);

  const handleRemove = useCallback((id: string) => {
    syncItems((prev) => prev.filter((i) => i.id !== id));
  }, [syncItems]);

  const handleEdit = useCallback((id: string, url: string) => {
    syncItems((prev) => prev.map((i) => (i.id === id ? { ...i, url } : i)));
    setEditingId(null);
  }, [syncItems]);

  const handleReorder = useCallback((reordered: ImageItem[]) => {
    syncItems(() => reordered);
  }, [syncItems]);

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
                  {item.url && (
                    brokenIds.has(item.id) ? (
                      <div className="img-list-thumb img-list-thumb-broken">
                        <ImageOff size={16} />
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt=""
                        className="img-list-thumb"
                        onError={() => setBrokenIds((prev) => new Set(prev).add(item.id))}
                      />
                    )
                  )}
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
