import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({ label, htmlFor, description, error, required, children }: FormFieldProps) {
  return (
    <div className="admin-form-field">
      <label className="admin-form-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="admin-form-required">*</span>}
      </label>
      {description && <p className="admin-form-description">{description}</p>}
      {children}
      {error && <p className="admin-form-error">{error}</p>}
    </div>
  );
}
