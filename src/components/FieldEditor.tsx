import { useState, useEffect } from 'react';
import type { FormField, FieldType, CustomFieldType } from '../types';
import { FIELD_TYPES } from './FormBuilder';

interface FieldEditorProps {
  field: FormField;
  onUpdate: (field: FormField) => void;
  onDelete: (id: string) => void;
  onMoveClick: () => void;
  isMoving: boolean;
  onCancelMove: () => void;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  forceCollapsed?: boolean;
  customFields?: CustomFieldType[];
}

export function FieldEditor({
  field,
  onUpdate,
  onDelete,
  onMoveClick,
  isMoving,
  onCancelMove,
  isFocused,
  onFocus,
  onBlur,
  forceCollapsed,
  customFields = [],
}: FieldEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Sync with forceCollapsed prop
  useEffect(() => {
    if (forceCollapsed !== undefined) {
      setIsExpanded(!forceCollapsed);
    }
  }, [forceCollapsed]);

  // Get library fields based on the field's own libraryId (not the global selection)
  const fieldLibraryId = field.libraryId;
  const libraryFields = fieldLibraryId 
    ? customFields.filter(cf => cf.libraryIds?.includes(fieldLibraryId))
    : [];
  
  const isLibraryField = fieldLibraryId && libraryFields.length > 0;

  const handleTypeChange = (value: string) => {
    if (isLibraryField) {
      // Value is a custom field ID
      const customField = customFields.find(cf => cf.id === value);
      if (customField) {
        const updatedField: FormField = {
          ...field,
          type: customField.baseType,
          customFieldTypeId: customField.id,
          options: customField.baseType === 'select' ? (field.options || ['Option 1', 'Option 2', 'Option 3']) : undefined,
          validationRules: customField.validationRules ? [...customField.validationRules] : undefined,
        };
        onUpdate(updatedField);
      }
    } else {
      // Value is a standard field type
      const newType = value as FieldType;
      const updatedField: FormField = {
        ...field,
        type: newType,
        customFieldTypeId: undefined,
        options: newType === 'select' ? (field.options || ['Option 1', 'Option 2', 'Option 3']) : undefined,
      };
      onUpdate(updatedField);
    }
  };

  // Get the current value for the select
  const selectValue = isLibraryField 
    ? (field.customFieldTypeId || libraryFields[0]?.id || '')
    : field.type;

  return (
    <div 
      className={`field-editor ${isMoving ? 'is-moving' : ''} ${isFocused ? 'is-focused' : ''}`}
      onFocus={onFocus}
      onBlur={(e) => {
        // Only blur if focus is leaving the entire field-editor
        if (!e.currentTarget.contains(e.relatedTarget)) {
          onBlur();
        }
      }}
    >
      <div className="field-editor-header">
        <div className="field-editor-title">
          <select
            className="field-type-select"
            value={selectValue}
            onChange={(e) => handleTypeChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          >
            {isLibraryField ? (
              libraryFields.map((cf) => (
                <option key={cf.id} value={cf.id}>
                  {cf.icon} {cf.name}
                </option>
              ))
            ) : (
              FIELD_TYPES.map(({ type, label, icon }) => (
                <option key={type} value={type}>
                  {icon} {label}
                </option>
              ))
            )}
          </select>
          <input
            type="text"
            className="field-label-input"
            value={field.label}
            onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Untitled Field"
          />
        </div>
        <div className="field-editor-actions">
          {isMoving ? (
            <button
              className="action-button cancel"
              onClick={(e) => { e.stopPropagation(); onCancelMove(); }}
            >
              Cancel
            </button>
          ) : (
            <button
              className="action-button move"
              onClick={(e) => { e.stopPropagation(); onMoveClick(); }}
            >
              ↕ Move
            </button>
          )}
          <button
            className="icon-button delete"
            onClick={(e) => { e.stopPropagation(); onDelete(field.id); }}
            title="Delete field"
          >
            ×
          </button>
          <button
            className="icon-button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="field-editor-body">
          <div className="form-group">
            <label>Placeholder Text</label>
            <input
              type="text"
              value={field.placeholder || ''}
              onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
              placeholder="Enter placeholder text..."
            />
          </div>

          {field.type === 'select' && (
            <div className="form-group">
              <label>Options (one per line)</label>
              <textarea
                value={(field.options || []).join('\n')}
                onChange={(e) =>
                  onUpdate({
                    ...field,
                    options: e.target.value.split('\n').filter((o) => o.trim()),
                  })
                }
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                rows={4}
              />
            </div>
          )}

          <div className="form-group-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
              />
              <span>Required</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={field.multiple}
                onChange={(e) => onUpdate({ ...field, multiple: e.target.checked })}
              />
              <span>Allow Multiple Values</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
