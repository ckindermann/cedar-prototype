import { useState, useEffect } from 'react';
import type { FormField, FormSchema, FieldType, CustomFieldType, FieldLibrary, TemplateLibrary } from '../types';
import { FieldEditor } from './FieldEditor';
import { FormPreview } from './FormPreview';
import { CreateFieldModal } from './CreateFieldModal';
import { FieldLibraryBrowser } from './FieldLibraryBrowser';
import { TemplateLibraryBrowser } from './TemplateLibraryBrowser';

const generateId = () => Math.random().toString(36).substring(2, 11);

interface DeletedFieldInfo {
  field: FormField;
  index: number;
}

interface SavedVersion {
  id: string;
  timestamp: Date;
  schema: FormSchema;
}

const formatVersionId = (date: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const formatVersionDisplay = (date: Date): string => {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const FIELD_TYPES: { type: FieldType; label: string; icon: string }[] = [
  { type: 'text', label: 'Text', icon: '📝' },
  { type: 'email', label: 'Email', icon: '✉️' },
  { type: 'number', label: 'Number', icon: '🔢' },
  { type: 'date', label: 'Date', icon: '📅' },
  { type: 'textarea', label: 'Long Text', icon: '📄' },
  { type: 'select', label: 'Dropdown', icon: '📋' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️' },
];

interface FormBuilderProps {
  customFields: CustomFieldType[];
  fieldLibraries: FieldLibrary[];
  onSaveCustomField: (field: CustomFieldType) => void;
  onSaveLibrary: (library: FieldLibrary) => void;
  templates: FormSchema[];
  activeTemplate: FormSchema;
  templateLibraries: TemplateLibrary[];
  onUpdateTemplate: (schema: FormSchema) => void;
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate: (libraryId?: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onSaveTemplateLibrary: (library: TemplateLibrary) => void;
  onDeleteTemplateLibrary: (id: string) => void;
}

export function FormBuilder({
  customFields,
  fieldLibraries,
  onSaveCustomField,
  onSaveLibrary,
  templates,
  activeTemplate,
  templateLibraries,
  onUpdateTemplate,
  onSelectTemplate,
  onCreateTemplate,
  onDeleteTemplate,
  onSaveTemplateLibrary,
  onDeleteTemplateLibrary,
}: FormBuilderProps) {
  // Use the activeTemplate as the schema, syncing changes back via onUpdateTemplate
  const schema = activeTemplate;
  const setSchema = (updater: FormSchema | ((prev: FormSchema) => FormSchema)) => {
    if (typeof updater === 'function') {
      onUpdateTemplate(updater(schema));
    } else {
      onUpdateTemplate(updater);
    }
  };

  const [activeTab, setActiveTab] = useState<'builder' | 'preview' | 'split'>('split');
  const [movingFieldId, setMovingFieldId] = useState<string | null>(null);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [deletedField, setDeletedField] = useState<DeletedFieldInfo | null>(null);
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [isCreateFieldModalOpen, setIsCreateFieldModalOpen] = useState(false);
  const [editingFieldType, setEditingFieldType] = useState<CustomFieldType | null>(null);
  const [createFieldForLibraryId, setCreateFieldForLibraryId] = useState<string | null>(null);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (deletedField) {
      const timer = setTimeout(() => {
        setDeletedField(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [deletedField]);

  const addField = (type: FieldType, customFieldTypeId?: string, libraryId?: string | null) => {
    const customField = customFieldTypeId ? customFields.find(cf => cf.id === customFieldTypeId) : undefined;
    
    const newField: FormField = {
      id: generateId(),
      type: customField ? customField.baseType : type,
      customFieldTypeId,
      libraryId: libraryId || undefined,
      label: '',
      placeholder: customField?.defaultPlaceholder || '',
      required: false,
      multiple: false,
      options: type === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
      validationRules: customField?.validationRules ? [...customField.validationRules] : undefined,
    };

    setSchema((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
  };

  const updateField = (updatedField: FormField) => {
    setSchema((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === updatedField.id ? updatedField : f)),
    }));
  };

  const deleteField = (id: string) => {
    const fieldIndex = schema.fields.findIndex((f) => f.id === id);
    const field = schema.fields[fieldIndex];
    
    if (field) {
      setDeletedField({ field, index: fieldIndex });
      setSchema((prev) => ({
        ...prev,
        fields: prev.fields.filter((f) => f.id !== id),
      }));
    }
  };

  const undoDelete = () => {
    if (deletedField) {
      setSchema((prev) => {
        const newFields = [...prev.fields];
        newFields.splice(deletedField.index, 0, deletedField.field);
        return { ...prev, fields: newFields };
      });
      setDeletedField(null);
    }
  };

  const dismissToast = () => {
    setDeletedField(null);
  };

  const moveFieldToPosition = (fieldId: string, targetIndex: number) => {
    setSchema((prev) => {
      const currentIndex = prev.fields.findIndex((f) => f.id === fieldId);
      if (currentIndex === -1) return prev;

      const newFields = [...prev.fields];
      const [movedField] = newFields.splice(currentIndex, 1);
      
      // Adjust target index if we're moving down (since we removed an item)
      const adjustedIndex = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
      newFields.splice(adjustedIndex, 0, movedField);

      return { ...prev, fields: newFields };
    });
    setMovingFieldId(null);
  };

  const handleMoveClick = (fieldId: string) => {
    setMovingFieldId(movingFieldId === fieldId ? null : fieldId);
  };

  const cancelMove = () => {
    setMovingFieldId(null);
  };

  const saveVersion = () => {
    const now = new Date();
    const versionId = formatVersionId(now);
    const newVersion: SavedVersion = {
      id: versionId,
      timestamp: now,
      schema: JSON.parse(JSON.stringify(schema)), // Deep copy
    };
    setSavedVersions((prev) => [newVersion, ...prev]);
    setCurrentVersionId(versionId);
    setIsVersionDropdownOpen(false);
  };

  const loadVersion = (version: SavedVersion) => {
    setSchema(JSON.parse(JSON.stringify(version.schema))); // Deep copy
    setCurrentVersionId(version.id);
    setIsVersionDropdownOpen(false);
  };

  return (
    <div className="form-builder">
      <header className="form-builder-header">
        <h1>Template Builder</h1>
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'builder' ? 'active' : ''}`}
            onClick={() => setActiveTab('builder')}
          >
            ✏️ Builder
          </button>
          <button
            className={`tab-button ${activeTab === 'split' ? 'active' : ''}`}
            onClick={() => setActiveTab('split')}
          >
            ⬛ Split
          </button>
          <button
            className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            👁️ Preview
          </button>
        </div>
        <div className="header-actions">
          <div className="version-control">
            <button className="save-button" onClick={saveVersion}>
              💾 Save
            </button>
            <div className="version-dropdown-container">
              <button
                className="version-dropdown-trigger"
                onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
              >
                {currentVersionId ? `v${currentVersionId}` : 'No saved versions'}
                <span className="dropdown-arrow">{isVersionDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {isVersionDropdownOpen && (
                <div className="version-dropdown">
                  {savedVersions.length === 0 ? (
                    <div className="version-dropdown-empty">No saved versions yet</div>
                  ) : (
                    savedVersions.map((version) => (
                      <button
                        key={version.id}
                        className={`version-option ${version.id === currentVersionId ? 'active' : ''}`}
                        onClick={() => loadVersion(version)}
                      >
                        <span className="version-id">v{version.id}</span>
                        <span className="version-date">{formatVersionDisplay(version.timestamp)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {activeTab === 'builder' && (
        <div className="form-builder-with-panel">
          <div className="library-panel">
            <div className="library-panel-stack">
              <TemplateLibraryBrowser
                templates={templates}
                templateLibraries={templateLibraries}
                activeTemplateId={activeTemplate.id}
                onSelectTemplate={onSelectTemplate}
                onCreateTemplate={onCreateTemplate}
                onCreateLibrary={(name, parentId) => {
                  const newLibrary: TemplateLibrary = {
                    id: generateId(),
                    name,
                    description: '',
                    parentId,
                  };
                  onSaveTemplateLibrary(newLibrary);
                }}
                onDeleteTemplate={onDeleteTemplate}
                onDeleteLibrary={onDeleteTemplateLibrary}
              />
              <FieldLibraryBrowser
              customFields={customFields}
              fieldLibraries={fieldLibraries}
              onAddField={(type, customFieldTypeId, libraryId) => {
                addField(type, customFieldTypeId, libraryId);
              }}
              onCreateLibrary={(name, parentId) => {
                const newLibrary: FieldLibrary = {
                  id: generateId(),
                  name,
                  description: '',
                  parentId,
                };
                onSaveLibrary(newLibrary);
              }}
              onCreateFieldType={(libraryId) => {
                setCreateFieldForLibraryId(libraryId);
                setEditingFieldType(null);
                setIsCreateFieldModalOpen(true);
              }}
              onEditFieldType={(fieldType) => {
                setEditingFieldType(fieldType);
                setIsCreateFieldModalOpen(true);
              }}
              highlightedFieldType={focusedFieldId ? (() => {
                const field = schema.fields.find(f => f.id === focusedFieldId);
                if (!field) return null;
                return {
                  type: field.type,
                  customFieldTypeId: field.customFieldTypeId,
                  libraryId: field.libraryId,
                };
              })() : null}
            />
            </div>
          </div>
          <div className="form-builder-main">
          <main className="form-canvas">
            <div className="form-meta">
              <input
                type="text"
                className="form-title-input"
                value={schema.title}
                onChange={(e) => setSchema((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Template Title"
              />
              <textarea
                className="form-description-input"
                value={schema.description}
                onChange={(e) => setSchema((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add a description for your template (optional)"
                rows={2}
              />
            </div>

            <div className={`fields-list ${movingFieldId ? 'moving-mode' : ''}`}>
              {schema.fields.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">📝</span>
                  <h3>Start building your template</h3>
                  <p>Select a field from the library to add it.</p>
                </div>
              ) : (
                <>
                  {schema.fields.map((field, index) => {
                    const isBeingMoved = movingFieldId === field.id;
                    const currentMovingIndex = schema.fields.findIndex(f => f.id === movingFieldId);
                    // Show insertion point before this field (but not adjacent to the moving field)
                    const showInsertBefore = movingFieldId && 
                      !isBeingMoved && 
                      index !== currentMovingIndex + 1 &&
                      index !== currentMovingIndex;

                    return (
                      <div key={field.id}>
                        {showInsertBefore && (
                          <button
                            className="insertion-point"
                            onClick={() => moveFieldToPosition(movingFieldId, index)}
                          >
                            <span className="insertion-line"></span>
                            <span className="insertion-label">Move here</span>
                            <span className="insertion-line"></span>
                          </button>
                        )}
                        <FieldEditor
                          field={field}
                          onUpdate={updateField}
                          onDelete={deleteField}
                          onMoveClick={() => handleMoveClick(field.id)}
                          isMoving={isBeingMoved}
                          onCancelMove={cancelMove}
                          isFocused={focusedFieldId === field.id}
                          onFocus={() => setFocusedFieldId(field.id)}
                          onBlur={() => setFocusedFieldId(null)}
                          customFields={customFields}
                          fieldLibraries={fieldLibraries}
                          onEditFieldType={(fieldType) => {
                            setEditingFieldType(fieldType);
                            setIsCreateFieldModalOpen(true);
                          }}
                        />
                      </div>
                    );
                  })}
                  {/* Show insertion point at the end if moving and not already last */}
                  {movingFieldId && schema.fields.findIndex(f => f.id === movingFieldId) !== schema.fields.length - 1 && (
                    <button
                      className="insertion-point"
                      onClick={() => moveFieldToPosition(movingFieldId, schema.fields.length)}
                    >
                      <span className="insertion-line"></span>
                      <span className="insertion-label">Move here</span>
                      <span className="insertion-line"></span>
                    </button>
                  )}
                </>
              )}
            </div>
          </main>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="preview-layout">
          <FormPreview schema={schema} focusedFieldId={null} />
        </div>
      )}

      {activeTab === 'split' && (
        <div className="split-layout-with-browser">
          <div className="split-library-panel">
            <div className="library-panel-stack">
              <TemplateLibraryBrowser
                templates={templates}
                templateLibraries={templateLibraries}
                activeTemplateId={activeTemplate.id}
                onSelectTemplate={onSelectTemplate}
                onCreateTemplate={onCreateTemplate}
                onCreateLibrary={(name, parentId) => {
                  const newLibrary: TemplateLibrary = {
                    id: generateId(),
                    name,
                    description: '',
                    parentId,
                  };
                  onSaveTemplateLibrary(newLibrary);
                }}
                onDeleteTemplate={onDeleteTemplate}
                onDeleteLibrary={onDeleteTemplateLibrary}
              />
              <FieldLibraryBrowser
              customFields={customFields}
              fieldLibraries={fieldLibraries}
              onAddField={(type, customFieldTypeId, libraryId) => {
                addField(type, customFieldTypeId, libraryId);
              }}
              onCreateLibrary={(name, parentId) => {
                const newLibrary: FieldLibrary = {
                  id: generateId(),
                  name,
                  description: '',
                  parentId,
                };
                onSaveLibrary(newLibrary);
              }}
              onCreateFieldType={(libraryId) => {
                setCreateFieldForLibraryId(libraryId);
                setEditingFieldType(null);
                setIsCreateFieldModalOpen(true);
              }}
              onEditFieldType={(fieldType) => {
                setEditingFieldType(fieldType);
                setIsCreateFieldModalOpen(true);
              }}
              highlightedFieldType={focusedFieldId ? (() => {
                const field = schema.fields.find(f => f.id === focusedFieldId);
                if (!field) return null;
                return {
                  type: field.type,
                  customFieldTypeId: field.customFieldTypeId,
                  libraryId: field.libraryId,
                };
              })() : null}
            />
            </div>
          </div>
          <div className="split-panel builder-panel">
            <div className="split-panel-header">Builder</div>
            <main className="form-canvas">
              <div className="form-meta">
                <input
                  type="text"
                  className="form-title-input"
                  value={schema.title}
                  onChange={(e) => setSchema((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Template Title"
                />
                <textarea
                  className="form-description-input"
                  value={schema.description}
                  onChange={(e) => setSchema((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Add a description for your template (optional)"
                  rows={2}
                />
              </div>

              <div className={`fields-list ${movingFieldId ? 'moving-mode' : ''}`}>
                {schema.fields.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📝</span>
                    <h3>Start building your template</h3>
                    <p>Select a field from the library to add it.</p>
                  </div>
                ) : (
                  <>
                    {schema.fields.map((field, index) => {
                      const isBeingMoved = movingFieldId === field.id;
                      const currentMovingIndex = schema.fields.findIndex(f => f.id === movingFieldId);
                      const showInsertBefore = movingFieldId && 
                        !isBeingMoved && 
                        index !== currentMovingIndex + 1 &&
                        index !== currentMovingIndex;

                      return (
                        <div key={field.id}>
                          {showInsertBefore && (
                            <button
                              className="insertion-point"
                              onClick={() => moveFieldToPosition(movingFieldId, index)}
                            >
                              <span className="insertion-line"></span>
                              <span className="insertion-label">Move here</span>
                              <span className="insertion-line"></span>
                            </button>
                          )}
                          <FieldEditor
                            field={field}
                            onUpdate={updateField}
                            onDelete={deleteField}
                            onMoveClick={() => handleMoveClick(field.id)}
                            isMoving={isBeingMoved}
                            onCancelMove={cancelMove}
                            isFocused={focusedFieldId === field.id}
                            onFocus={() => setFocusedFieldId(field.id)}
                            onBlur={() => setFocusedFieldId(null)}
                            customFields={customFields}
                            fieldLibraries={fieldLibraries}
                            onEditFieldType={(fieldType) => {
                              setEditingFieldType(fieldType);
                              setIsCreateFieldModalOpen(true);
                            }}
                          />
                        </div>
                      );
                    })}
                    {movingFieldId && schema.fields.findIndex(f => f.id === movingFieldId) !== schema.fields.length - 1 && (
                      <button
                        className="insertion-point"
                        onClick={() => moveFieldToPosition(movingFieldId, schema.fields.length)}
                      >
                        <span className="insertion-line"></span>
                        <span className="insertion-label">Move here</span>
                        <span className="insertion-line"></span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </main>
          </div>
          <div className="split-panel preview-panel">
            <div className="split-panel-header">Preview</div>
            <div className="preview-layout">
              <FormPreview schema={schema} focusedFieldId={focusedFieldId} />
            </div>
          </div>
        </div>
      )}

      {deletedField && (
        <div className="undo-toast">
          <span>Field "{deletedField.field.label || 'Untitled Field'}" deleted</span>
          <button className="undo-button" onClick={undoDelete}>
            Undo
          </button>
          <button className="dismiss-button" onClick={dismissToast}>
            ×
          </button>
        </div>
      )}

      <CreateFieldModal
        isOpen={isCreateFieldModalOpen}
        onClose={() => {
          setIsCreateFieldModalOpen(false);
          setEditingFieldType(null);
          setCreateFieldForLibraryId(null);
        }}
        onSave={onSaveCustomField}
        fieldLibraries={fieldLibraries}
        preSelectedLibraryId={createFieldForLibraryId}
        editingField={editingFieldType}
      />
    </div>
  );
}
