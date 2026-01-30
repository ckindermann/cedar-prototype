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

interface FieldDesignerProps {
  customFields: CustomFieldType[];
  fieldLibraries: FieldLibrary[];
  onSaveField: (field: CustomFieldType) => void;
  onDeleteField: (id: string) => void;
  onSaveLibrary: (library: FieldLibrary) => void;
  onDeleteLibrary: (id: string) => void;
}

export function FieldDesigner({ 
  customFields, 
  fieldLibraries,
  onSaveField, 
  onDeleteField,
  onSaveLibrary,
  onDeleteLibrary,
}: FieldDesignerProps) {
  const [editingField, setEditingField] = useState<CustomFieldType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'fields' | 'libraries'>('fields');
  const [editingLibrary, setEditingLibrary] = useState<FieldLibrary | null>(null);
  const [isCreatingLibrary, setIsCreatingLibrary] = useState(false);

  const [librarySearch, setLibrarySearch] = useState('');
  const [isLibrarySearchOpen, setIsLibrarySearchOpen] = useState(false);

  const createNewField = () => {
    const newField: CustomFieldType = {
      id: generateId(),
      name: '',
      baseType: 'text',
      icon: '🔧',
      description: '',
      validationRules: [],
      defaultPlaceholder: '',
    };
    setEditingField(newField);
    setIsCreating(true);
  };

  const handleSave = () => {
    if (editingField && editingField.name.trim()) {
      onSaveField(editingField);
      setEditingField(null);
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setIsCreating(false);
  };

  const updateEditingField = (updates: Partial<CustomFieldType>) => {
    if (editingField) {
      setEditingField({ ...editingField, ...updates });
    }
  };

  const addValidationRule = () => {
    if (!editingField) return;
    const applicableTypes = VALIDATION_TYPES.filter(v => v.appliesTo.includes(editingField.baseType));
    if (applicableTypes.length === 0) return;

    const newRule: ValidationRule = {
      type: applicableTypes[0].type,
      value: '',
      message: '',
    };
    updateEditingField({
      validationRules: [...editingField.validationRules, newRule],
    });
  };

  const updateValidationRule = (index: number, updates: Partial<ValidationRule>) => {
    if (!editingField) return;
    const newRules = [...editingField.validationRules];
    newRules[index] = { ...newRules[index], ...updates };
    updateEditingField({ validationRules: newRules });
  };

  const removeValidationRule = (index: number) => {
    if (!editingField) return;
    const newRules = editingField.validationRules.filter((_, i) => i !== index);
    updateEditingField({ validationRules: newRules });
  };

  const getApplicableValidationTypes = (baseType: FieldType) => {
    return VALIDATION_TYPES.filter(v => v.appliesTo.includes(baseType));
  };

  const createNewLibrary = () => {
    const newLibrary: FieldLibrary = {
      id: generateId(),
      name: '',
      description: '',
    };
    setEditingLibrary(newLibrary);
    setIsCreatingLibrary(true);
  };

  const handleSaveLibrary = () => {
    if (editingLibrary && editingLibrary.name.trim()) {
      onSaveLibrary(editingLibrary);
      setEditingLibrary(null);
      setIsCreatingLibrary(false);
    }
  };

  const handleCancelLibrary = () => {
    setEditingLibrary(null);
    setIsCreatingLibrary(false);
  };

  const getLibraryNames = (libraryIds?: string[]) => {
    if (!libraryIds || libraryIds.length === 0) return 'Unassigned';
    const names = libraryIds
      .map(id => fieldLibraries.find(l => l.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Unassigned';
  };

  const toggleLibraryAssignment = (libraryId: string) => {
    if (!editingField) return;
    const currentIds = editingField.libraryIds || [];
    const newIds = currentIds.includes(libraryId)
      ? currentIds.filter(id => id !== libraryId)
      : [...currentIds, libraryId];
    updateEditingField({ libraryIds: newIds });
  };

  return (
    <div className="field-designer">
      <div className="field-designer-header">
        <h2>Field Designer</h2>
        <p className="field-designer-description">
          Create custom field types and organize them into libraries
        </p>
      </div>

      <div className="designer-tabs">
        <button
          className={`designer-tab ${activeTab === 'fields' ? 'active' : ''}`}
          onClick={() => setActiveTab('fields')}
        >
          🔧 Custom Fields
        </button>
        <button
          className={`designer-tab ${activeTab === 'libraries' ? 'active' : ''}`}
          onClick={() => setActiveTab('libraries')}
        >
          📚 Libraries
        </button>
      </div>

      {activeTab === 'fields' && (
        <>
          {!editingField ? (
            <>
              <div className="custom-fields-list">
                {customFields.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">🔧</span>
                    <h3>No custom fields yet</h3>
                    <p>Create custom field types with validation rules to reuse across your forms.</p>
                  </div>
                ) : (
                  customFields.map((field) => (
                    <div key={field.id} className="custom-field-card">
                      <div className="custom-field-info">
                        <span className="custom-field-icon">{field.icon}</span>
                        <div className="custom-field-details">
                          <span className="custom-field-name">{field.name}</span>
                          <span className="custom-field-base">
                            Based on: {BASE_FIELD_TYPES.find(t => t.type === field.baseType)?.label}
                          </span>
                          <span className="custom-field-library">
                            📚 {getLibraryNames(field.libraryIds)}
                          </span>
                          {field.description && (
                            <span className="custom-field-desc">{field.description}</span>
                          )}
                          {field.validationRules.length > 0 && (
                            <span className="custom-field-rules">
                              {field.validationRules.length} validation rule{field.validationRules.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="custom-field-actions">
                        <button
                          className="action-button"
                          onClick={() => {
                            setEditingField({ ...field });
                            setIsCreating(false);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="action-button delete"
                          onClick={() => onDeleteField(field.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className="add-field-button" onClick={createNewField}>
                + Create Custom Field Type
              </button>
            </>
          ) : (
            <div className="field-editor-panel">
              <h3>{isCreating ? 'Create Custom Field Type' : 'Edit Custom Field Type'}</h3>

              <div className="form-group">
                <label>Field Type Name *</label>
                <input
                  type="text"
                  value={editingField.name}
                  onChange={(e) => updateEditingField({ name: e.target.value })}
                  placeholder="e.g., Phone Number, ZIP Code, URL..."
                />
              </div>

              <div className="form-group">
                <label>Icon</label>
                <input
                  type="text"
                  value={editingField.icon}
                  onChange={(e) => updateEditingField({ icon: e.target.value })}
                  placeholder="Enter an emoji"
                  className="icon-input"
                />
              </div>

              <div className="form-group">
                <label>Base Field Type</label>
                <select
                  value={editingField.baseType}
                  onChange={(e) => {
                    const newBaseType = e.target.value as FieldType;
                    const applicableRules = editingField.validationRules.filter(rule =>
                      VALIDATION_TYPES.find(v => v.type === rule.type)?.appliesTo.includes(newBaseType)
                    );
                    updateEditingField({ baseType: newBaseType, validationRules: applicableRules });
                  }}
                >
                  {BASE_FIELD_TYPES.map(({ type, label, icon }) => (
                    <option key={type} value={type}>
                      {icon} {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Assign to Libraries</label>
                {fieldLibraries.length === 0 ? (
                  <span className="input-hint">Create libraries in the Libraries tab first</span>
                ) : (
                  <div className="library-assignment">
                    {/* Assigned libraries list */}
                    {(editingField.libraryIds || []).length > 0 && (
                      <div className="assigned-libraries">
                        {(editingField.libraryIds || []).map((libId) => {
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
                              !(editingField.libraryIds || []).includes(lib.id) &&
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
                            !(editingField.libraryIds || []).includes(lib.id) &&
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
                  value={editingField.description || ''}
                  onChange={(e) => updateEditingField({ description: e.target.value })}
                  placeholder="Describe what this field type is for..."
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label>Default Placeholder (optional)</label>
                <input
                  type="text"
                  value={editingField.defaultPlaceholder || ''}
                  onChange={(e) => updateEditingField({ defaultPlaceholder: e.target.value })}
                  placeholder="e.g., Enter your phone number..."
                />
              </div>

              <div className="validation-rules-section">
                <div className="section-header">
                  <label>Validation Rules</label>
                  {getApplicableValidationTypes(editingField.baseType).length > 0 && (
                    <button className="add-rule-button" onClick={addValidationRule}>
                      + Add Rule
                    </button>
                  )}
                </div>

                {editingField.validationRules.length === 0 ? (
                  <p className="no-rules-message">No validation rules added yet.</p>
                ) : (
                  <div className="validation-rules-list">
                    {editingField.validationRules.map((rule, index) => (
                      <div key={index} className="validation-rule">
                        <div className="validation-rule-header">
                          <select
                            value={rule.type}
                            onChange={(e) =>
                              updateValidationRule(index, { type: e.target.value as ValidationRule['type'] })
                            }
                          >
                            {getApplicableValidationTypes(editingField.baseType).map(({ type, label }) => (
                              <option key={type} value={type}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="remove-rule-button"
                            onClick={() => removeValidationRule(index)}
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
                              type={rule.type === 'min' || rule.type === 'max' || rule.type === 'minLength' || rule.type === 'maxLength' ? 'number' : 'text'}
                              value={rule.value}
                              onChange={(e) =>
                                updateValidationRule(index, {
                                  value: rule.type === 'minLength' || rule.type === 'maxLength' || rule.type === 'min' || rule.type === 'max'
                                    ? Number(e.target.value)
                                    : e.target.value,
                                })
                              }
                              placeholder={rule.type === 'regex' ? 'e.g., ^[0-9]{5}$' : 'Enter value...'}
                            />
                            {rule.type === 'regex' && (
                              <span className="input-hint">Enter a JavaScript regex pattern</span>
                            )}
                          </div>

                          <div className="form-group">
                            <label>Error Message</label>
                            <input
                              type="text"
                              value={rule.message}
                              onChange={(e) => updateValidationRule(index, { message: e.target.value })}
                              placeholder="e.g., Please enter a valid ZIP code"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="editor-panel-actions">
                <button className="action-button cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  className="action-button save"
                  onClick={handleSave}
                  disabled={!editingField.name.trim()}
                >
                  {isCreating ? 'Create Field Type' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'libraries' && (
        <>
          {!editingLibrary ? (
            <>
              <div className="custom-fields-list">
                {fieldLibraries.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📚</span>
                    <h3>No libraries yet</h3>
                    <p>Create libraries to organize your custom field types into groups.</p>
                  </div>
                ) : (
                  fieldLibraries.map((library) => {
                    const fieldCount = customFields.filter(f => f.libraryIds?.includes(library.id)).length;
                    return (
                      <div key={library.id} className="custom-field-card">
                        <div className="custom-field-info">
                          <span className="custom-field-icon">📁</span>
                          <div className="custom-field-details">
                            <span className="custom-field-name">{library.name}</span>
                            {library.description && (
                              <span className="custom-field-desc">{library.description}</span>
                            )}
                            <span className="custom-field-rules">
                              {fieldCount} field{fieldCount !== 1 ? 's' : ''} assigned
                            </span>
                          </div>
                        </div>
                        <div className="custom-field-actions">
                          <button
                            className="action-button"
                            onClick={() => {
                              setEditingLibrary({ ...library });
                              setIsCreatingLibrary(false);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="action-button delete"
                            onClick={() => onDeleteLibrary(library.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <button className="add-field-button" onClick={createNewLibrary}>
                + Create Library
              </button>
            </>
          ) : (
            <div className="field-editor-panel">
              <h3>{isCreatingLibrary ? 'Create Library' : 'Edit Library'}</h3>

              <div className="form-group">
                <label>Library Name *</label>
                <input
                  type="text"
                  value={editingLibrary.name}
                  onChange={(e) => setEditingLibrary({ ...editingLibrary, name: e.target.value })}
                  placeholder="e.g., Contact Info, Address Fields, Medical..."
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={editingLibrary.description || ''}
                  onChange={(e) => setEditingLibrary({ ...editingLibrary, description: e.target.value })}
                  placeholder="Describe what this library is for..."
                  rows={2}
                />
              </div>

              <div className="editor-panel-actions">
                <button className="action-button cancel" onClick={handleCancelLibrary}>
                  Cancel
                </button>
                <button
                  className="action-button save"
                  onClick={handleSaveLibrary}
                  disabled={!editingLibrary.name.trim()}
                >
                  {isCreatingLibrary ? 'Create Library' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
