import { useState, useCallback } from 'react';
import { DragSortList } from './DragSortList';
import { Plus, X } from 'lucide-react';

export interface StepItem {
  step?: number;
  duration?: string;
  description?: string;
}

interface ProductionStepsEditorProps {
  steps: StepItem[];
  onChange: (steps: StepItem[]) => void;
}

interface IdStepItem {
  id: string;
  data: StepItem;
}

let stepId = 1;
function makeStepId() {
  return `step-${stepId++}-${Date.now()}`;
}

function wrapSteps(steps: StepItem[]): IdStepItem[] {
  return steps.map((data) => ({ id: makeStepId(), data }));
}

export function ProductionStepsEditor({ steps, onChange }: ProductionStepsEditorProps) {
  const [wrapped, setWrapped] = useState<IdStepItem[]>(() => wrapSteps(steps));

  const sync = useCallback((newWrapped: IdStepItem[]) => {
    setWrapped(newWrapped);
    onChange(newWrapped.map((w, i) => ({ ...w.data, step: i + 1 })));
  }, [onChange]);

  const handleAdd = useCallback(() => {
    sync([...wrapped, { id: makeStepId(), data: { step: wrapped.length + 1, duration: '', description: '' } }]);
  }, [wrapped, sync]);

  const handleRemove = useCallback((id: string) => {
    sync(wrapped.filter((w) => w.id !== id));
  }, [wrapped, sync]);

  const handleUpdate = useCallback((id: string, field: keyof StepItem, value: string) => {
    sync(wrapped.map((w) => {
      if (w.id !== id) return w;
      return { ...w, data: { ...w.data, [field]: value } };
    }));
  }, [wrapped, sync]);

  const handleReorder = useCallback((reordered: IdStepItem[]) => {
    sync(reordered);
  }, [sync]);

  return (
    <div className="steps-editor">
      {wrapped.length > 0 && (
        <DragSortList
          items={wrapped}
          keyExtractor={(w) => w.id}
          onReorder={handleReorder}
          renderItem={(item, index) => (
            <div className="step-item-fields">
              <span className="step-number">{index + 1}</span>
              <input
                className="admin-input"
                value={item.data.duration ?? ''}
                onChange={(e) => handleUpdate(item.id, 'duration', e.target.value)}
                placeholder="기간 (예: 1~2일)"
                style={{ width: 140 }}
              />
              <input
                className="admin-input"
                value={item.data.description ?? ''}
                onChange={(e) => handleUpdate(item.id, 'description', e.target.value)}
                placeholder="설명"
                style={{ flex: 1 }}
              />
              <button type="button" className="admin-btn-icon admin-btn-icon-danger" onClick={() => handleRemove(item.id)}>
                <X size={14} />
              </button>
            </div>
          )}
        />
      )}
      <button type="button" className="admin-btn admin-btn-secondary" onClick={handleAdd} style={{ marginTop: 8 }}>
        <Plus size={14} /> 단계 추가
      </button>
    </div>
  );
}
