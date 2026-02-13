interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  const toggleClass = ['admin-toggle', checked ? 'admin-toggle-checked' : '', disabled ? 'admin-toggle-disabled' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="admin-toggle-wrapper">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={toggleClass}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="admin-toggle-thumb" />
      </button>
      {label && <span className="admin-toggle-label">{label}</span>}
    </div>
  );
}
