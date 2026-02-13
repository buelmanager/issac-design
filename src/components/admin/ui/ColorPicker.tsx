interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presets?: string[];
}

export function ColorPicker({ value, onChange, label, presets }: ColorPickerProps) {
  function handleHexInput(hex: string) {
    const cleaned = hex.startsWith('#') ? hex : `#${hex}`;
    if (/^#[0-9a-fA-F]{0,6}$/.test(cleaned)) {
      onChange(cleaned);
    }
  }

  return (
    <div className="admin-color-picker">
      {label && <label className="admin-color-picker-label">{label}</label>}
      <div className="admin-color-picker-controls">
        <div className="admin-color-swatch" data-color={value}>
          <input
            type="color"
            className="admin-color-native"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <input
          type="text"
          className="admin-color-hex"
          value={value}
          onChange={(e) => handleHexInput(e.target.value)}
          maxLength={7}
        />
      </div>
      {presets && presets.length > 0 && (
        <div className="admin-color-presets">
          {presets.map((color) => (
            <button
              key={color}
              type="button"
              className={`admin-color-preset ${color === value ? 'admin-color-preset-active' : ''}`}
              data-color={color}
              onClick={() => onChange(color)}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
