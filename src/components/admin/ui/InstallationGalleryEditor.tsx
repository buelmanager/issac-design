import { useState, useCallback } from 'react';
import { ImageUploader } from './ImageUploader';
import { DragSortList } from './DragSortList';
import { Plus, X } from 'lucide-react';

export interface GalleryItem {
  image_before?: string;
  image_after?: string;
  location?: string;
}

interface InstallationGalleryEditorProps {
  items: GalleryItem[];
  onChange: (items: GalleryItem[]) => void;
}

interface IdGalleryItem {
  id: string;
  data: GalleryItem;
}

let galId = 1;
function makeGalId() {
  return `gal-${galId++}-${Date.now()}`;
}

function wrap(items: GalleryItem[]): IdGalleryItem[] {
  return items.map((data) => ({ id: makeGalId(), data }));
}

export function InstallationGalleryEditor({ items, onChange }: InstallationGalleryEditorProps) {
  const [wrapped, setWrapped] = useState<IdGalleryItem[]>(() => wrap(items));

  const sync = useCallback((newWrapped: IdGalleryItem[]) => {
    setWrapped(newWrapped);
    onChange(newWrapped.map((w) => w.data));
  }, [onChange]);

  const handleAdd = useCallback(() => {
    sync([...wrapped, { id: makeGalId(), data: { image_before: '', image_after: '', location: '' } }]);
  }, [wrapped, sync]);

  const handleRemove = useCallback((id: string) => {
    sync(wrapped.filter((w) => w.id !== id));
  }, [wrapped, sync]);

  const handleUpdate = useCallback((id: string, field: keyof GalleryItem, value: string) => {
    sync(wrapped.map((w) => {
      if (w.id !== id) return w;
      return { ...w, data: { ...w.data, [field]: value } };
    }));
  }, [wrapped, sync]);

  const handleReorder = useCallback((reordered: IdGalleryItem[]) => {
    sync(reordered);
  }, [sync]);

  return (
    <div className="gallery-editor">
      {wrapped.length > 0 && (
        <DragSortList
          items={wrapped}
          keyExtractor={(w) => w.id}
          onReorder={handleReorder}
          renderItem={(item) => (
            <div className="gallery-card">
              <div className="gallery-card-images">
                <div className="gallery-card-img-col">
                  <label className="gallery-card-label">Before</label>
                  <ImageUploader
                    value={item.data.image_before ?? ''}
                    onChange={(url) => handleUpdate(item.id, 'image_before', url)}
                    folder="gallery"
                  />
                </div>
                <div className="gallery-card-img-col">
                  <label className="gallery-card-label">After</label>
                  <ImageUploader
                    value={item.data.image_after ?? ''}
                    onChange={(url) => handleUpdate(item.id, 'image_after', url)}
                    folder="gallery"
                  />
                </div>
              </div>
              <div className="gallery-card-footer">
                <input
                  className="admin-input"
                  value={item.data.location ?? ''}
                  onChange={(e) => handleUpdate(item.id, 'location', e.target.value)}
                  placeholder="위치 (예: 서울 강남구)"
                />
                <button type="button" className="admin-btn-icon admin-btn-icon-danger" onClick={() => handleRemove(item.id)}>
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        />
      )}
      <button type="button" className="admin-btn admin-btn-secondary" onClick={handleAdd} style={{ marginTop: 8 }}>
        <Plus size={14} /> 시공 사례 추가
      </button>
    </div>
  );
}
