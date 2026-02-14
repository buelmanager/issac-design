import { useState, useMemo } from 'react';
import { ROUTE_OPTIONS, getGroupedRoutes } from '../../../lib/route-options';

interface LinkSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const CUSTOM_VALUE = '__custom__';

export function LinkSelect({ value, onChange, placeholder, className }: LinkSelectProps) {
  const grouped = useMemo(() => getGroupedRoutes(), []);
  const groups = useMemo(() => Array.from(grouped.entries()), [grouped]);

  const isKnownRoute = ROUTE_OPTIONS.some((r) => r.value === value);
  const [customMode, setCustomMode] = useState(!isKnownRoute && value !== '');

  const handleSelect = (selected: string) => {
    if (selected === CUSTOM_VALUE) {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    onChange(selected);
  };

  if (customMode) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          className={className ?? 'admin-input'}
          value={value}
          placeholder={placeholder ?? '외부 URL을 입력하세요'}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn-sm"
          onClick={() => {
            setCustomMode(false);
            onChange('');
          }}
          title="목록에서 선택"
        >
          목록
        </button>
      </div>
    );
  }

  return (
    <select
      className={className ?? 'admin-select'}
      value={isKnownRoute ? value : ''}
      onChange={(e) => handleSelect(e.target.value)}
    >
      <option value="">{placeholder ?? '링크를 선택하세요'}</option>
      {groups.map(([group, routes]) => (
        <optgroup key={group} label={group}>
          {routes.map((route) => (
            <option key={route.value} value={route.value}>
              {route.label} ({route.value})
            </option>
          ))}
        </optgroup>
      ))}
      <option value={CUSTOM_VALUE}>직접 입력...</option>
    </select>
  );
}
