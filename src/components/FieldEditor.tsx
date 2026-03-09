import type {
  CustomFieldType,
  CustomFieldVersion,
  FieldLibrary,
  FieldType,
  FormField,
  FormSchema,
  TemplateVersion,
} from '../types';
import { FIELD_TYPES } from './FormBuilder';

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

interface FieldEditorProps {
  field: FormField;
  position: number;
  onUpdate: (field: FormField) => void;
  onDelete: (id: string) => void;
  isFocused: boolean;
  onFocus: () => void;
  onBlur: () => void;
  customFields?: CustomFieldType[];
  customFieldVersions?: Record<string, CustomFieldVersion[]>;
  fieldLibraries?: FieldLibrary[];
  templates?: FormSchema[];
  templateVersions?: Record<string, TemplateVersion[]>;
  currentTemplateId?: string;
  showSemanticFields?: boolean;
  showVersionControls?: boolean;
  onEditFieldType?: (fieldType: CustomFieldType) => void;
}

export function FieldEditor({
  field,
  position,
  onUpdate,
  onDelete,
  isFocused,
  onFocus,
  onBlur,
  customFields = [],
  customFieldVersions = {},
  fieldLibraries = [],
  templates = [],
  templateVersions = {},
  currentTemplateId,
  showSemanticFields = false,
  showVersionControls = false,
  onEditFieldType,
}: FieldEditorProps) {

  // Get library fields based on the field's own libraryId (not the global selection)
  const fieldLibraryId = field.libraryId;
  const libraryFields = fieldLibraryId 
    ? customFields.filter(cf => cf.libraryIds?.includes(fieldLibraryId))
    : [];
  
  const isLibraryField = fieldLibraryId && libraryFields.length > 0;
  const isTemplateComponentField = field.type === 'template';
  const availableTemplates = templates.filter((template) => template.id !== currentTemplateId);

  const handleTypeChange = (value: string) => {
    if (isLibraryField) {
      // Value is a custom field ID
      const customField = customFields.find(cf => cf.id === value);
      if (customField) {
        const updatedField: FormField = {
          ...field,
          type: customField.baseType,
          customFieldTypeId: customField.id,
          customFieldVersion: customField.version,
          description: customField.description || '',
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
        customFieldVersion: undefined,
        options: newType === 'select' ? (field.options || ['Option 1', 'Option 2', 'Option 3']) : undefined,
      };
      onUpdate(updatedField);
    }
  };

  // Get the current value for the select
  const selectValue = isLibraryField
    ? (field.customFieldTypeId || libraryFields[0]?.id || '')
    : field.type;

  // Get the current custom field type if this is a library field
  const currentCustomField = field.customFieldTypeId 
    ? customFields.find(cf => cf.id === field.customFieldTypeId)
    : null;
  const customFieldVersionHistory = field.customFieldTypeId
    ? (customFieldVersions[field.customFieldTypeId] || [])
    : [];
  const selectedCustomFieldVersion = field.customFieldVersion || currentCustomField?.version;
  const selectedTemplate = field.componentTemplateId
    ? templates.find((template) => template.id === field.componentTemplateId)
    : null;
  const componentTemplateVersionHistory = field.componentTemplateId
    ? (templateVersions[field.componentTemplateId] || [])
    : [];

  const getLatestTemplateVersion = (templateId: string): number | undefined => {
    const versions = templateVersions[templateId] || [];
    if (versions.length > 0) {
      return versions[versions.length - 1].version;
    }
    return templates.find((template) => template.id === templateId)?.version;
  };

  // Get the library name for display
  const fieldLibrary = field.libraryId 
    ? fieldLibraries.find(l => l.id === field.libraryId)
    : null;

  return (
    <div 
      className={`field-editor ${isFocused ? 'is-focused' : ''}`}
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
          <span className="field-order-badge" title={`Field ${position} in template`}>
            {position}
          </span>
          {isTemplateComponentField ? (
            <span className="field-type-badge">🧩 Component</span>
          ) : (
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
          )}
          {showVersionControls && !!field.customFieldTypeId && customFieldVersionHistory.length > 0 && (
            <select
              className="field-type-select field-version-select"
              value={selectedCustomFieldVersion || ''}
              onChange={(e) => {
                const version = Number(e.target.value);
                const selectedVersion = customFieldVersionHistory.find((item) => item.version === version);
                if (!selectedVersion) return;
                const snapshot = selectedVersion.snapshot;
                onUpdate({
                  ...field,
                  type: snapshot.baseType,
                  customFieldVersion: selectedVersion.version,
                  description: snapshot.description || '',
                  options: snapshot.baseType === 'select' ? (field.options || ['Option 1', 'Option 2', 'Option 3']) : undefined,
                  validationRules: deepClone(snapshot.validationRules),
                });
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {[...customFieldVersionHistory]
                .sort((a, b) => b.version - a.version)
                .map((item) => (
                  <option key={`${field.customFieldTypeId}-v${item.version}`} value={item.version}>
                    v{item.version}
                  </option>
                ))}
            </select>
          )}
          {fieldLibrary && (
            <span className="field-library-badge" title={`From library: ${fieldLibrary.name}`}>
              📁 {fieldLibrary.name}
            </span>
          )}
          {currentCustomField && onEditFieldType && (
            <button
              className="edit-field-type-button"
              onClick={(e) => {
                e.stopPropagation();
                onEditFieldType(currentCustomField);
              }}
              title="Edit this field type"
            >
              ✏️
            </button>
          )}
          <input
            type="text"
            className="field-label-input"
            value={field.label}
            onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder={isTemplateComponentField ? 'Component Name' : 'Untitled Field'}
          />
        </div>
        <div className="field-editor-actions">
          <span className="drag-handle" title="Drag to reorder">⠿</span>
          <button
            className="icon-button delete"
            onClick={(e) => { e.stopPropagation(); onDelete(field.id); }}
            title="Delete field"
          >
            ×
          </button>
        </div>
      </div>

      <div className="field-editor-body">
          {showSemanticFields && (
            <div className="form-group">
              <label>Field Name IRI</label>
              <input
                type="text"
                value={field.nameIri || ''}
                onChange={(e) => onUpdate({ ...field, nameIri: e.target.value })}
                placeholder="https://example.org/iri/field-name"
              />
              <span className="input-hint">Paste an IRI to semantically identify this field name.</span>
            </div>
          )}
          {isTemplateComponentField ? (
            <div className="form-group">
              <label>Referenced Template</label>
              <select
                value={field.componentTemplateId || ''}
                onChange={(e) => {
                  const templateId = e.target.value || undefined;
                  onUpdate({
                    ...field,
                    componentTemplateId: templateId,
                    componentTemplateVersion: templateId ? getLatestTemplateVersion(templateId) : undefined,
                  });
                }}
              >
                <option value="">Select a template...</option>
                {availableTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title || 'Untitled Template'}
                  </option>
                ))}
              </select>
              {showVersionControls && selectedTemplate && componentTemplateVersionHistory.length > 0 && (
                <div className="form-group" style={{ marginTop: '10px', marginBottom: 0 }}>
                  <label>Template Version</label>
                  <select
                    value={field.componentTemplateVersion || selectedTemplate.version}
                    onChange={(e) =>
                      onUpdate({
                        ...field,
                        componentTemplateVersion: Number(e.target.value),
                      })
                    }
                  >
                    {[...componentTemplateVersionHistory]
                      .sort((a, b) => b.version - a.version)
                      .map((item) => (
                        <option key={`${selectedTemplate.id}-v${item.version}`} value={item.version}>
                          v{item.version}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              {availableTemplates.length === 0 && (
                <span className="input-hint">No other templates available to reference.</span>
              )}
            </div>
          ) : (
            <>
          <div className="field-detail-row">
            <div className="form-group">
              <label>Placeholder Text</label>
              <input
                type="text"
                value={field.placeholder || ''}
                onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
                placeholder="Enter placeholder text..."
              />
            </div>
            <div className="form-group">
              <label>Field Description</label>
              <input
                type="text"
                value={field.description || ''}
                onChange={(e) => onUpdate({ ...field, description: e.target.value })}
                placeholder="Short description for tooltip..."
              />
            </div>
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
            </>
          )}
        </div>
    </div>
  );
}
