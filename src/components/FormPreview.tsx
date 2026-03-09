import { useState } from 'react';
import type { FormField, FormSchema, TemplateVersion } from '../types';

interface FormPreviewProps {
  schema: FormSchema;
  focusedFieldId: string | null;
  templates?: FormSchema[];
  templateVersions?: Record<string, TemplateVersion[]>;
  showVersionInfo?: boolean;
}

export function FormPreview({
  schema,
  focusedFieldId,
  templates = [],
  templateVersions = {},
  showVersionInfo = false,
}: FormPreviewProps) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});

  const handleChange = (valueKey: string, value: string, isMultiple: boolean, index?: number) => {
    setValues((prev) => {
      if (isMultiple && typeof index === 'number') {
        const currentValues = (prev[valueKey] as string[]) || [''];
        const newValues = [...currentValues];
        newValues[index] = value;
        return { ...prev, [valueKey]: newValues };
      }
      return { ...prev, [valueKey]: value };
    });
  };

  const addValue = (valueKey: string) => {
    setValues((prev) => {
      const currentValues = (prev[valueKey] as string[]) || [''];
      return { ...prev, [valueKey]: [...currentValues, ''] };
    });
  };

  const removeValue = (valueKey: string, index: number) => {
    setValues((prev) => {
      const currentValues = (prev[valueKey] as string[]) || [''];
      if (currentValues.length <= 1) return prev;
      const newValues = currentValues.filter((_, i) => i !== index);
      return { ...prev, [valueKey]: newValues };
    });
  };

  const renderField = (
    field: FormField,
    position: number,
    valueKey: string,
    ancestry: Set<string>,
  ): React.ReactNode => {
    const isFocused = focusedFieldId === field.id;

    if (field.type === 'template') {
      const nestedTemplateId = field.componentTemplateId;
      const versionHistory = nestedTemplateId ? (templateVersions[nestedTemplateId] || []) : [];
      const requestedVersion = field.componentTemplateVersion;
      const matchingVersion = requestedVersion
        ? versionHistory.find((version) => version.version === requestedVersion)
        : undefined;
      const latestVersion = versionHistory.length > 0 ? versionHistory[versionHistory.length - 1] : undefined;
      const nestedTemplate = matchingVersion?.snapshot || latestVersion?.snapshot || (
        nestedTemplateId
          ? templates.find((template) => template.id === nestedTemplateId)
          : undefined
      );
      const nestedTemplateVersion = matchingVersion?.version || latestVersion?.version || nestedTemplate?.version;
      const hasCycle = nestedTemplate ? ancestry.has(nestedTemplate.id) : false;
      const nextAncestry = nestedTemplate
        ? new Set([...Array.from(ancestry), nestedTemplate.id])
        : ancestry;

      return (
        <div className={`preview-field nested-template-component ${isFocused ? 'is-focused' : ''}`} key={valueKey}>
          <label>
            <span className="preview-field-order">{position}.</span>
            <span
              className={field.description ? 'preview-name-with-tooltip' : undefined}
              title={field.description || undefined}
            >
              {field.label || 'Template Component'}
            </span>
          </label>
          <div className="nested-template-preview">
            {!nestedTemplateId && (
              <div className="nested-template-empty">No template selected.</div>
            )}
            {nestedTemplateId && !nestedTemplate && (
              <div className="nested-template-empty">Referenced template was not found.</div>
            )}
            {nestedTemplate && hasCycle && (
              <div className="nested-template-empty">Circular template reference detected.</div>
            )}
            {nestedTemplate && !hasCycle && (
              <>
                <div className="nested-template-header">
                  <span
                    className={nestedTemplate.description ? 'preview-name-with-tooltip' : undefined}
                    title={nestedTemplate.description || undefined}
                  >
                    {nestedTemplate.title || 'Untitled Template'}
                  </span>
                  {showVersionInfo && nestedTemplateVersion && (
                    <span className="nested-template-version"> v{nestedTemplateVersion}</span>
                  )}
                </div>
                {nestedTemplate.fields.length === 0 ? (
                  <div className="nested-template-empty">No fields in this template.</div>
                ) : (
                  <div className="nested-template-fields">
                    {nestedTemplate.fields.map((nestedField, nestedIndex) =>
                      renderField(
                        nestedField,
                        nestedIndex + 1,
                        `${valueKey}.${nestedField.id}`,
                        nextAncestry,
                      ),
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }

    const fieldValues = field.multiple
      ? ((values[valueKey] as string[]) || [''])
      : values[valueKey] || '';

    const renderInput = (value: string, index?: number) => {
      const inputProps = {
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
          handleChange(valueKey, e.target.value, field.multiple, index),
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

        case 'ontology-select':
          {
            const ontologyOptions = (
              field.ontologyOptions && field.ontologyOptions.length > 0
                ? field.ontologyOptions
                : (field.ontologyOptionSources || []).flatMap((source) => source.options || [])
            );
          return (
            <select {...inputProps}>
              <option value="">Select a class...</option>
              {ontologyOptions.map((option) => (
                <option key={option.iri} value={option.iri}>
                  {option.label}
                </option>
              ))}
            </select>
          );
          }

        case 'checkbox':
          return (
            <label className="preview-checkbox">
              <input
                type="checkbox"
                checked={value === 'true'}
                onChange={(e) => handleChange(valueKey, e.target.checked ? 'true' : 'false', field.multiple, index)}
              />
              <span>{field.placeholder || 'Yes'}</span>
            </label>
          );

        case 'text':
        case 'email':
        case 'number':
        case 'date':
          return <input type={field.type} {...inputProps} />;

        default:
          return <input type="text" {...inputProps} />;
      }
    };

    if (field.multiple && field.type !== 'checkbox') {
      const valuesArray = Array.isArray(fieldValues) ? fieldValues : [fieldValues];
      return (
        <div className={`preview-field ${isFocused ? 'is-focused' : ''}`} key={valueKey}>
          <label>
            <span className="preview-field-order">{position}.</span>
            <span
              className={field.description ? 'preview-name-with-tooltip' : undefined}
              title={field.description || undefined}
            >
              {field.label}
            </span>
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
                    onClick={() => removeValue(valueKey, idx)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-value-btn" onClick={() => addValue(valueKey)}>
              + Add Another
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className={`preview-field ${isFocused ? 'is-focused' : ''}`} key={valueKey}>
        <label>
          <span className="preview-field-order">{position}.</span>
          <span
            className={field.description ? 'preview-name-with-tooltip' : undefined}
            title={field.description || undefined}
          >
            {field.label}
          </span>
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
        <h2
          className={schema.description ? 'preview-name-with-tooltip' : undefined}
          title={schema.description || undefined}
        >
          {schema.title || 'Untitled Template'}
        </h2>
        {schema.description && <p className="preview-description">{schema.description}</p>}
      </div>
      <form className="preview-form" onSubmit={(e) => e.preventDefault()}>
        {schema.fields.map((field, index) =>
          renderField(field, index + 1, field.id, new Set([schema.id])),
        )}
        <div className="preview-actions">
          <button type="submit" className="submit-btn">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
