interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClassMap: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'admin-spinner-sm',
  md: 'admin-spinner-md',
  lg: 'admin-spinner-lg',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const classes = ['admin-spinner', sizeClassMap[size], className].filter(Boolean).join(' ');

  return <div className={classes} />;
}
