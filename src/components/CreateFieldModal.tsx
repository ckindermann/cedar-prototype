import { useState } from 'react';
import type { CustomFieldType, FieldType, ValidationRule, FieldLibrary } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const BASE_FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Text', icon: '📝' },
  { type: 'email', label: 'Email', icon: '✉️' },
  { type: 'number', label: 'Number', icon: '🔢' },
  { type: 'date', label: 'Date', icon: '📅' },
  { type: 'textarea', label: 'Long Text', icon: '📄' },
  { type: 'select', label: 'Dropdown', icon: '📋' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️' },
];

const VALIDATION_TYPES: { type: ValidationRule['type']; label: string; appliesTo: FieldType[] }[] = [
  { type: 'regex', label: 'Regex Pattern', appliesTo: ['text', 'email', 'textarea'] },
  { type: 'minLength', label: 'Minimum Length', appliesTo: ['text', 'email', 'textarea'] },
  { type: 'maxLength', label: 'Maximum Length', appliesTo: ['text', 'email', 'textarea'] },
  { type: 'min', label: 'Minimum Value', appliesTo: ['number', 'date'] },
  { type: 'max', label: 'Maximum Value', appliesTo: ['number', 'date'] },
];

interface CreateFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: CustomFieldType) => void;
  fieldLibraries: FieldLibrary[];
  preSelectedLibraryId?: string | null;
  editingField?: CustomFieldType | null; // If provided, modal is in edit mode
}

export function CreateFieldModal({
  isOpen,
  onClose,
  onSave,
  fieldLibraries,
  preSelectedLibraryId,
  editingField,
}: CreateFieldModalProps) {
  const isEditMode = !!editingField;
  const [field, setField] = useState<CustomFieldType>(() => 
    editingField || createEmptyField(preSelectedLibraryId)
  );
  const [librarySearch, setLibrarySearch] = useState('');
  const [isLibrarySearchOpen, setIsLibrarySearchOpen] = useState(false);

  function createEmptyField(libraryId?: string | null): CustomFieldType {
    return {
      id: generateId(),
      name: '',
      baseType: 'text',
      icon: '🔧',
      description: '',
      validationRules: [],
      defaultPlaceholder: '',
      libraryIds: libraryId ? [libraryId] : [],
    };
  }

  // Reset form when modal opens with new preSelectedLibraryId or editingField
  const handleOpen = () => {
    if (editingField) {
      setField({ ...editingField });
    } else {
      setField(createEmptyField(preSelectedLibraryId));
    }
    setLibrarySearch('');
    setIsLibrarySearchOpen(false);
  };

  // Reset when opening - check if we need to sync with editingField or create new
  if (isOpen && editingField && field.id !== editingField.id) {
    handleOpen();
  } else if (isOpen && !editingField && field.id && !field.name && field.libraryIds?.join(',') !== (preSelectedLibraryId ? [preSelectedLibraryId].join(',') : '')) {
    handleOpen();
  }

  if (!isOpen) return null;

  const updateField = (updates: Partial<CustomFieldType>) => {
    setField(prev => ({ ...prev, ...updates }));
  };

  const toggleLibraryAssignment = (libraryId: string) => {
    const currentIds = field.libraryIds || [];
    const newIds = currentIds.includes(libraryId)
      ? currentIds.filter(id => id !== libraryId)
      : [...currentIds, libraryId];
    updateField({ libraryIds: newIds });
  };

  const addValidationRule = () => {
    const applicableTypes = VALIDATION_TYPES.filter(v => v.appliesTo.includes(field.baseType));
    if (applicableTypes.length === 0) return;

    const newRule: ValidationRule = {
      type: applicableTypes[0].type,
      value: '',
      message: '',
    };
    updateField({
      validationRules: [...field.validationRules, newRule],
    });
  };

  const updateValidationRule = (index: number, updates: Partial<ValidationRule>) => {
    const newRules = [...field.validationRules];
    newRules[index] = { ...newRules[index], ...updates };
    updateField({ validationRules: newRules });
  };

  const removeValidationRule = (index: number) => {
    const newRules = field.validationRules.filter((_, i) => i !== index);
    updateField({ validationRules: newRules });
  };

  const getApplicableValidationTypes = (baseType: FieldType) => {
    return VALIDATION_TYPES.filter(v => v.appliesTo.includes(baseType));
  };

  const handleSave = () => {
    if (field.name.trim()) {
      onSave(field);
      if (!editingField) {
        setField(createEmptyField(preSelectedLibraryId));
      }
      onClose();
    }
  };

  const handleCancel = () => {
    if (!editingField) {
      setField(createEmptyField(preSelectedLibraryId));
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content create-field-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? '✏️ Edit Field Type' : '✨ Create Custom Field Type'}</h2>
          <button className="modal-close" onClick={handleCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Field Type Name *</label>
            <input
              type="text"
              value={field.name}
              onChange={(e) => updateField({ name: e.target.value })}
              placeholder="e.g., Phone Number, ZIP Code, URL..."
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Icon</label>
              <input
                type="text"
                value={field.icon}
                onChange={(e) => updateField({ icon: e.target.value })}
                placeholder="Enter an emoji"
                className="icon-input"
              />
            </div>

            <div className="form-group">
              <label>Base Field Type</label>
              <select
                value={field.baseType}
                onChange={(e) => {
                  const newBaseType = e.target.value as FieldType;
                  const applicableRules = field.validationRules.filter(rule =>
                    VALIDATION_TYPES.find(v => v.type === rule.type)?.appliesTo.includes(newBaseType)
                  );
                  updateField({ baseType: newBaseType, validationRules: applicableRules });
                }}
              >
                {BASE_FIELD_TYPES.map(({ type, label, icon }) => (
                  <option key={type} value={type}>
                    {icon} {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Assign to Libraries</label>
            {fieldLibraries.length === 0 ? (
              <span className="input-hint">No libraries available. Create one in the Field Designer.</span>
            ) : (
              <div className="library-assignment">
                {/* Assigned libraries list */}
                {(field.libraryIds || []).length > 0 && (
                  <div className="assigned-libraries">
                    {(field.libraryIds || []).map((libId) => {
                      const library = fieldLibraries.find(l => l.id === libId);
                      if (!library) return null;
                      return (
                        <span key={libId} className="library-tag">
                          📁 {library.name}
                          <button
                            type="button"
                            className="library-tag-remove"
                            onClick={() => toggleLibraryAssignment(libId)}
                            title="Remove from library"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                
                {/* Library search dropdown */}
                <div className="library-search-container">
                  <input
                    type="text"
                    className="library-search-input"
                    value={librarySearch}
                    onChange={(e) => {
                      setLibrarySearch(e.target.value);
                      setIsLibrarySearchOpen(true);
                    }}
                    onFocus={() => setIsLibrarySearchOpen(true)}
                    placeholder="Search libraries to add..."
                  />
                  {isLibrarySearchOpen && (
                    <div className="library-search-dropdown">
                      {fieldLibraries
                        .filter(lib => 
                          !(field.libraryIds || []).includes(lib.id) &&
                          lib.name.toLowerCase().includes(librarySearch.toLowerCase())
                        )
                        .map((library) => (
                          <button
                            key={library.id}
                            type="button"
                            className="library-search-option"
                            onClick={() => {
                              toggleLibraryAssignment(library.id);
                              setLibrarySearch('');
                              setIsLibrarySearchOpen(false);
                            }}
                          >
                            📁 {library.name}
                            {library.description && (
                              <span className="library-search-desc">{library.description}</span>
                            )}
                          </button>
                        ))}
                      {fieldLibraries.filter(lib => 
                        !(field.libraryIds || []).includes(lib.id) &&
                        lib.name.toLowerCase().includes(librarySearch.toLowerCase())
                      ).length === 0 && (
                        <div className="library-search-empty">
                          {librarySearch ? 'No matching libraries' : 'All libraries assigned'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Description (optional)</label>
            <textarea
              value={field.description || ''}
              onChange={(e) => updateField({ description: e.target.value })}
              placeholder="Describe what this field type is for..."
              rows={2}
            />
          </div>

          <div className="form-group">
            <label>Default Placeholder (optional)</label>
            <input
              type="text"
              value={field.defaultPlaceholder || ''}
              onChange={(e) => updateField({ defaultPlaceholder: e.target.value })}
              placeholder="e.g., Enter your phone number..."
            />
          </div>

          <div className="validation-rules-section">
            <div className="section-header">
              <label>Validation Rules</label>
              {getApplicableValidationTypes(field.baseType).length > 0 && (
                <button className="add-rule-button" onClick={addValidationRule}>
                  + Add Rule
                </button>
              )}
            </div>

            {field.validationRules.length === 0 ? (
              <p className="no-rules-message">No validation rules added yet.</p>
            ) : (
              <div className="validation-rules-list">
                {field.validationRules.map((rule, index) => (
                  <div key={index} className="validation-rule">
                    <div className="validation-rule-header">
                      <select
                        value={rule.type}
                        onChange={(e) =>
                          updateValidationRule(index, { type: e.target.value as ValidationRule['type'] })
                        }
                      >
                        {getApplicableValidationTypes(field.baseType).map(({ type, label }) => (
                          <option key={type} value={type}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="remove-rule-button"
                        onClick={() => removeValidationRule(index)}
                        title="Remove rule"
                      >
                        ×
                      </button>
                    </div>
                    <div className="validation-rule-body">
                      <div className="form-group">
                        <label>
                          {rule.type === 'regex' ? 'Pattern' : 'Value'}
                        </label>
                        <input
                          type={rule.type === 'min' || rule.type === 'max' || 
                                rule.type === 'minLength' || rule.type === 'maxLength' 
                                ? 'number' : 'text'}
                          value={rule.value}
                          onChange={(e) => updateValidationRule(index, { 
                            value: rule.type === 'minLength' || rule.type === 'maxLength' ||
                                   rule.type === 'min' || rule.type === 'max'
                              ? Number(e.target.value) 
                              : e.target.value 
                          })}
                          placeholder={rule.type === 'regex' ? '^[0-9]{5}$' : ''}
                        />
                      </div>
                      <div className="form-group">
                        <label>Error Message</label>
                        <input
                          type="text"
                          value={rule.message}
                          onChange={(e) => updateValidationRule(index, { message: e.target.value })}
                          placeholder="e.g., Please enter a valid value"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="action-button cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button 
            className="action-button save" 
            onClick={handleSave}
            disabled={!field.name.trim()}
          >
            {isEditMode ? 'Save Changes' : 'Create Field Type'}
          </button>
        </div>
      </div>
    </div>
  );
}
