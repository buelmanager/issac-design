import type { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface DragSortListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (items: T[]) => void;
}

interface SortableItemProps {
  id: string;
  children: ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="admin-drag-item" {...attributes}>
      <button type="button" className="admin-drag-handle" {...listeners}>
        <GripVertical size={16} />
      </button>
      {children}
    </div>
  );
}

export function DragSortList<T>({ items, keyExtractor, renderItem, onReorder }: DragSortListProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => keyExtractor(item) === String(active.id));
    const newIndex = items.findIndex((item) => keyExtractor(item) === String(over.id));

    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  }

  const ids = items.map(keyExtractor);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="admin-drag-list">
          {items.map((item, index) => (
            <SortableItem key={keyExtractor(item)} id={keyExtractor(item)}>
              {renderItem(item, index)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
