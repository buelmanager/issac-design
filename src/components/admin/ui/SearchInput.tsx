import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({ value, onChange, placeholder = 'Search...', debounceMs = 300 }: SearchInputProps) {
  const [internal, setInternal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setInternal(value);
  }, [value]);

  function handleChange(next: string) {
    setInternal(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(next), debounceMs);
  }

  function handleClear() {
    setInternal('');
    onChange('');
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="admin-search-input">
      <Search className="admin-search-icon" size={16} />
      <input
        type="text"
        className="admin-search-field"
        value={internal}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
      />
      {internal && (
        <button type="button" className="admin-search-clear" onClick={handleClear}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
