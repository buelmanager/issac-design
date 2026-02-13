import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export function TagInput({ tags, onChange, placeholder = 'Add tag...', maxTags }: TagInputProps) {
  const [input, setInput] = useState('');

  function addTag(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    if (maxTags && tags.length >= maxTags) return;
    onChange([...tags, trimmed]);
    setInput('');
  }

  function removeTag(index: number) {
    onChange(tags.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <div className="admin-tag-input">
      {tags.map((tag, index) => (
        <span key={`${tag}-${index}`} className="admin-tag">
          {tag}
          <button type="button" className="admin-tag-remove" onClick={() => removeTag(index)}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        type="text"
        className="admin-tag-field"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        disabled={maxTags !== undefined && tags.length >= maxTags}
      />
    </div>
  );
}
