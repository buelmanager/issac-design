interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
}

const statusVariantMap: Record<string, StatusBadgeProps['variant']> = {
  published: 'success',
  completed: 'success',
  active: 'success',
  replied: 'success',
  pending: 'warning',
  draft: 'warning',
  reviewing: 'warning',
  new: 'info',
  read: 'info',
  cancelled: 'danger',
  deleted: 'danger',
  closed: 'danger',
};

function resolveVariant(status: string, variant?: StatusBadgeProps['variant']): NonNullable<StatusBadgeProps['variant']> {
  if (variant) return variant;
  return statusVariantMap[status.toLowerCase()] ?? 'default';
}

export function StatusBadge({ status, variant }: StatusBadgeProps) {
  const resolved = resolveVariant(status, variant);

  return (
    <span className={`admin-badge admin-badge-${resolved}`}>
      {status}
    </span>
  );
}
