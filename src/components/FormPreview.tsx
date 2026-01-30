import { useState } from 'react';
import type { FormField, FormSchema } from '../types';

interface FormPreviewProps {
  schema: FormSchema;
  focusedFieldId: string | null;
}

export function FormPreview({ schema, focusedFieldId }: FormPreviewProps) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});

  const handleChange = (fieldId: string, value: string, index?: number) => {
    setValues((prev) => {
      const field = schema.fields.find((f) => f.id === fieldId);
      if (field?.multiple && typeof index === 'number') {
        const currentValues = (prev[fieldId] as string[]) || [''];
        const newValues = [...currentValues];
        newValues[index] = value;
        return { ...prev, [fieldId]: newValues };
      }
      return { ...prev, [fieldId]: value };
    });
  };

  const addValue = (fieldId: string) => {
    setValues((prev) => {
      const currentValues = (prev[fieldId] as string[]) || [''];
      return { ...prev, [fieldId]: [...currentValues, ''] };
    });
  };

  const removeValue = (fieldId: string, index: number) => {
    setValues((prev) => {
      const currentValues = (prev[fieldId] as string[]) || [''];
      if (currentValues.length <= 1) return prev;
      const newValues = currentValues.filter((_, i) => i !== index);
      return { ...prev, [fieldId]: newValues };
    });
  };

  const renderField = (field: FormField) => {
    const fieldValues = field.multiple
      ? ((values[field.id] as string[]) || [''])
      : values[field.id] || '';

    const renderInput = (value: string, index?: number) => {
      const inputProps = {
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
          handleChange(field.id, e.target.value, index),
        placeholder: field.placeholder,
        required: field.required,
      };

      switch (field.type) {
        case 'textarea':
          return <textarea {...inputProps} rows={4} />;

        case 'select':
          return (
            <select {...inputProps}>
              <option value="">Select an option...</option>
              {(field.options || []).map((opt, i) => (
                <option key={i} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          );

        case 'checkbox':
          return (
            <label className="preview-checkbox">
              <input
                type="checkbox"
                checked={value === 'true'}
                onChange={(e) => handleChange(field.id, e.target.checked ? 'true' : 'false', index)}
              />
              <span>{field.placeholder || 'Yes'}</span>
            </label>
          );

        default:
          return <input type={field.type} {...inputProps} />;
      }
    };

    const isFocused = focusedFieldId === field.id;

    if (field.multiple && field.type !== 'checkbox') {
      const valuesArray = Array.isArray(fieldValues) ? fieldValues : [fieldValues];
      return (
        <div className={`preview-field ${isFocused ? 'is-focused' : ''}`} key={field.id}>
          <label>
            {field.label}
            {field.required && <span className="required-asterisk">*</span>}
          </label>
          <div className="multiple-values">
            {valuesArray.map((val, idx) => (
              <div key={idx} className="multiple-value-row">
                {renderInput(val, idx)}
                {valuesArray.length > 1 && (
                  <button
                    type="button"
                    className="remove-value-btn"
                    onClick={() => removeValue(field.id, idx)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-value-btn" onClick={() => addValue(field.id)}>
              + Add Another
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`preview-field ${isFocused ? 'is-focused' : ''}`} key={field.id}>
        <label>
          {field.label}
          {field.required && <span className="required-asterisk">*</span>}
        </label>
        {renderInput(typeof fieldValues === 'string' ? fieldValues : fieldValues[0] || '')}
      </div>
    );
  };

  if (schema.fields.length === 0) {
    return (
      <div className="form-preview empty">
        <div className="empty-preview">
          <span className="empty-icon">📋</span>
          <h3>No fields yet</h3>
          <p>Add fields using the buttons on the left to see a preview here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-preview">
      <div className="preview-header">
        <h2>{schema.title || 'Untitled Template'}</h2>
        {schema.description && <p className="preview-description">{schema.description}</p>}
      </div>
      <form className="preview-form" onSubmit={(e) => e.preventDefault()}>
        {schema.fields.map((field) => renderField(field))}
        <div className="preview-actions">
          <button type="submit" className="submit-btn">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
