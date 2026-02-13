import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="admin-empty-state">
      {icon && <div className="admin-empty-state-icon">{icon}</div>}
      <h3 className="admin-empty-state-title">{title}</h3>
      {description && <p className="admin-empty-state-description">{description}</p>}
      {action && (
        <button type="button" className="admin-btn admin-btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
