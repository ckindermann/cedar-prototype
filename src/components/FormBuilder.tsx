import { useState, useEffect, useMemo } from 'react';
import type {
  BuilderProfile,
  CustomFieldType,
  CustomFieldVersion,
  FieldLibrary,
  FieldType,
  FormField,
  FormSchema,
  TemplateLibrary,
  TemplateVersion,
} from '../types';
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

interface TemplateDisplayOptions {
  showDescription: boolean;
  showIri: boolean;
}
type TemplateChangeType = 'text' | 'non-text';

const formatVersionDisplay = (timestamp: string): string => {
  return new Date(timestamp).toLocaleString('en-US', {
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
  { type: 'ontology-select', label: 'Ontology Dropdown', icon: '🧬' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑️' },
];

interface FormBuilderProps {
  customFields: CustomFieldType[];
  customFieldVersions: Record<string, CustomFieldVersion[]>;
  fieldLibraries: FieldLibrary[];
  onSaveCustomField: (field: CustomFieldType, profile: BuilderProfile) => void;
  onSaveLibrary: (library: FieldLibrary) => void;
  templates: FormSchema[];
  templateVersions: Record<string, TemplateVersion[]>;
  activeTemplate: FormSchema;
  templateLibraries: TemplateLibrary[];
  onUpdateTemplate: (
    schema: FormSchema,
    profile: BuilderProfile,
    changeTypeHint?: TemplateChangeType,
    textChangeKey?: string,
  ) => void;
  onSaveTemplateVersion: (templateId: string) => void;
  onLoadTemplateVersion: (templateId: string, version: number) => void;
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate: (libraryId?: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onMoveTemplate: (templateId: string, targetLibraryId?: string) => void;
  onSaveTemplateLibrary: (library: TemplateLibrary) => void;
  onMoveTemplateLibrary: (libraryId: string, targetParentId?: string) => void;
  onDeleteTemplateLibrary: (id: string) => void;
  onMoveCustomField: (fieldTypeId: string, targetLibraryId?: string) => void;
  onMoveFieldLibrary: (libraryId: string, targetParentId?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function FormBuilder({
  customFields,
  customFieldVersions,
  fieldLibraries,
  onSaveCustomField,
  onSaveLibrary,
  templates,
  templateVersions,
  activeTemplate,
  templateLibraries,
  onUpdateTemplate,
  onSaveTemplateVersion,
  onLoadTemplateVersion,
  onSelectTemplate,
  onCreateTemplate,
  onDeleteTemplate,
  onMoveTemplate,
  onSaveTemplateLibrary,
  onMoveTemplateLibrary,
  onDeleteTemplateLibrary,
  onMoveCustomField,
  onMoveFieldLibrary,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: FormBuilderProps) {
  const schema = activeTemplate;
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [deletedField, setDeletedField] = useState<DeletedFieldInfo | null>(null);
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
  const [isCreateFieldModalOpen, setIsCreateFieldModalOpen] = useState(false);
  const [editingFieldType, setEditingFieldType] = useState<CustomFieldType | null>(null);
  const [createFieldForLibraryId, setCreateFieldForLibraryId] = useState<string | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [searchTemplates, setSearchTemplates] = useState(true);
  const [searchFields, setSearchFields] = useState(true);
  const [activeProfile, setActiveProfile] = useState<BuilderProfile>('basic');
  const [isTemplateOptionsOpen, setIsTemplateOptionsOpen] = useState(false);
  const [templateDisplayOptions, setTemplateDisplayOptions] = useState<TemplateDisplayOptions>({
    showDescription: true,
    showIri: true,
  });

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (deletedField) {
      const timer = setTimeout(() => {
        setDeletedField(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [deletedField]);

  const profileIncludes = (minimumProfile: BuilderProfile): boolean => {
    const profileOrder: Record<BuilderProfile, number> = {
      basic: 0,
      semantic: 1,
      modular: 2,
    };
    return profileOrder[activeProfile] >= profileOrder[minimumProfile];
  };
  const semanticEnabled = profileIncludes('semantic');
  const modularVersioningEnabled = activeProfile === 'modular';
  const latestCustomFieldVersionById = useMemo(
    () => new Map(customFields.map((fieldType) => [fieldType.id, fieldType.version])),
    [customFields],
  );
  const outdatedFieldVersionCount = useMemo(
    () =>
      schema.fields.filter((field) => {
        if (!field.customFieldTypeId) return false;
        const latestVersion = latestCustomFieldVersionById.get(field.customFieldTypeId);
        if (!latestVersion) return false;
        const configuredVersion = field.customFieldVersion ?? latestVersion;
        return configuredVersion !== latestVersion;
      }).length,
    [schema.fields, latestCustomFieldVersionById],
  );
  const isTemplateReadOnlyInProfile = activeProfile !== 'modular' && outdatedFieldVersionCount > 0;
  const staleFieldVersionLabel =
    outdatedFieldVersionCount === 1 ? 'field version' : 'field versions';

  const setSchema = (
    updater: FormSchema | ((prev: FormSchema) => FormSchema),
    changeTypeHint: TemplateChangeType = 'non-text',
    textChangeKey?: string,
  ) => {
    if (isTemplateReadOnlyInProfile) return;
    if (typeof updater === 'function') {
      onUpdateTemplate(updater(schema), activeProfile, changeTypeHint, textChangeKey);
    } else {
      onUpdateTemplate(updater, activeProfile, changeTypeHint, textChangeKey);
    }
  };

  const templateDependsOn = (
    sourceTemplateId: string,
    targetTemplateId: string,
    visited = new Set<string>(),
  ): boolean => {
    if (visited.has(sourceTemplateId)) return false;
    visited.add(sourceTemplateId);

    const sourceTemplate = templates.find((template) => template.id === sourceTemplateId);
    if (!sourceTemplate) return false;

    return sourceTemplate.fields.some((field) => {
      if (field.type !== 'template' || !field.componentTemplateId) return false;
      if (field.componentTemplateId === targetTemplateId) return true;
      return templateDependsOn(field.componentTemplateId, targetTemplateId, visited);
    });
  };

  const canAddTemplateAsComponent = (templateId: string): boolean => {
    if (!profileIncludes('modular')) return false;
    if (templateId === schema.id) return false;
    return !templateDependsOn(templateId, schema.id);
  };

  const getCustomFieldVersion = (
    customFieldTypeId: string,
    version?: number,
  ): CustomFieldType | undefined => {
    const versions = customFieldVersions[customFieldTypeId] || [];
    if (versions.length === 0) {
      return customFields.find((fieldType) => fieldType.id === customFieldTypeId);
    }
    if (version) {
      const exact = versions.find((item) => item.version === version);
      if (exact) return exact.snapshot;
    }
    return versions[versions.length - 1]?.snapshot;
  };

  const addField = (
    type: FieldType,
    customFieldTypeId?: string,
    libraryId?: string | null,
    customFieldVersion?: number,
  ) => {
    const customField = customFieldTypeId
      ? getCustomFieldVersion(customFieldTypeId, customFieldVersion)
      : undefined;
    const resolvedType = customField ? customField.baseType : type;
    
    const newField: FormField = {
      id: generateId(),
      type: resolvedType,
      customFieldTypeId,
      customFieldVersion: customField?.version,
      libraryId: libraryId || undefined,
      label: '',
      description: customField?.description || '',
      nameIri: customField?.nameIri || '',
      nameIriLabel: customField?.nameIriLabel || '',
      placeholder: customField?.defaultPlaceholder || '',
      required: false,
      multiple: false,
      options: resolvedType === 'select' ? ['Option 1', 'Option 2', 'Option 3'] : undefined,
      ontologyOptions: resolvedType === 'ontology-select'
        ? ((customField?.ontologyOptions || []).map((option) => ({ ...option })))
        : undefined,
      ontologyOptionSources: resolvedType === 'ontology-select'
        ? ((customField?.ontologyOptionSources || []).map((source) => ({
          ...source,
          options: source.options.map((option) => ({ ...option })),
        })))
        : undefined,
      validationRules: customField?.validationRules ? [...customField.validationRules] : undefined,
    };

    setSchema((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
  };

  const addTemplateComponent = (templateId: string) => {
    if (!canAddTemplateAsComponent(templateId)) return;

    const referencedTemplate = templates.find((template) => template.id === templateId);
    const componentName = referencedTemplate?.title
      ? `${referencedTemplate.title} Component`
      : 'Template Component';

    const newField: FormField = {
      id: generateId(),
      type: 'template',
      componentTemplateId: templateId,
      componentTemplateVersion: referencedTemplate?.version,
      label: componentName,
      description: referencedTemplate?.description || '',
      nameIri: '',
      required: false,
      multiple: false,
    };

    setSchema((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
  };

  const updateField = (
    updatedField: FormField,
    changeTypeHint: TemplateChangeType = 'non-text',
    textChangeKey?: string,
  ) => {
    setSchema((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === updatedField.id ? updatedField : f)),
    }), changeTypeHint, textChangeKey);
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
  };

  const handleDragStart = (fieldId: string) => {
    if (isTemplateReadOnlyInProfile) return;
    setDraggedFieldId(fieldId);
  };

  const handleDragEnd = () => {
    if (isTemplateReadOnlyInProfile) return;
    if (draggedFieldId && dropTargetIndex !== null) {
      moveFieldToPosition(draggedFieldId, dropTargetIndex);
    }
    setDraggedFieldId(null);
    setDropTargetIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isTemplateReadOnlyInProfile) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetIndex(index);
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    if (isTemplateReadOnlyInProfile) return;
    e.preventDefault();
    if (draggedFieldId) {
      moveFieldToPosition(draggedFieldId, index);
    }
    setDraggedFieldId(null);
    setDropTargetIndex(null);
  };

  const saveVersion = () => {
    onSaveTemplateVersion(schema.id);
    setIsVersionDropdownOpen(false);
  };

  const templateVersionHistory = (templateVersions[schema.id] || [])
    .slice()
    .sort((a, b) => b.version - a.version);

  const loadVersion = (version: TemplateVersion) => {
    onLoadTemplateVersion(schema.id, version.version);
    setIsVersionDropdownOpen(false);
  };

  const renderVersionControl = () => (
    <div className="version-control">
      <button className="save-button" onClick={saveVersion}>
        💾 Save
      </button>
      <div className="version-dropdown-container">
        <button
          className="version-dropdown-trigger"
          onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
        >
          {templateVersionHistory.length > 0 ? `v${schema.version}` : 'No saved versions'}
          <span className="dropdown-arrow">{isVersionDropdownOpen ? '▲' : '▼'}</span>
        </button>
        {isVersionDropdownOpen && (
          <div className="version-dropdown">
            {templateVersionHistory.length === 0 ? (
              <div className="version-dropdown-empty">No saved versions yet</div>
            ) : (
              templateVersionHistory.map((version) => (
                <button
                  key={`${schema.id}-v${version.version}`}
                  className={`version-option ${version.version === schema.version ? 'active' : ''}`}
                  onClick={() => loadVersion(version)}
                >
                  <span className="version-id">v{version.version}</span>
                  <span className="version-date">{formatVersionDisplay(version.savedAt)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderHistoryControls = () => (
    <div className="history-control">
      <button
        type="button"
        className="history-button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
      >
        ↶ Undo
      </button>
      <button
        type="button"
        className="history-button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y or Ctrl/Cmd+Shift+Z)"
      >
        ↷ Redo
      </button>
    </div>
  );

  const toggleTemplateDisplayOption = (option: keyof TemplateDisplayOptions) => {
    setTemplateDisplayOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

  return (
    <div className="form-builder">
      <header className="form-builder-header">
        <h1>Template Builder</h1>
        <div className="builder-mode-buttons" aria-label="Builder modes">
          <button
            type="button"
            className={`builder-mode-button ${activeProfile === 'basic' ? 'is-active' : ''}`}
            onClick={() => setActiveProfile('basic')}
          >
            Basic
          </button>
          <button
            type="button"
            className={`builder-mode-button ${activeProfile === 'semantic' ? 'is-active' : ''}`}
            onClick={() => setActiveProfile('semantic')}
          >
            Semantic
          </button>
          <button
            type="button"
            className={`builder-mode-button ${activeProfile === 'modular' ? 'is-active' : ''}`}
            onClick={() => setActiveProfile('modular')}
          >
            Modular
          </button>
        </div>
      </header>

      <div className="split-layout-with-browser">
          <div className="split-library-panel">
            <div className="library-panel-stack">
              <div className="unified-search">
                <div className="unified-search-bar">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search..."
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  />
                </div>
                <div className="search-filters">
                  <label className="search-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={searchTemplates}
                      onChange={(e) => setSearchTemplates(e.target.checked)}
                    />
                    <span>Templates</span>
                  </label>
                  <label className="search-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={searchFields}
                      onChange={(e) => setSearchFields(e.target.checked)}
                    />
                    <span>Fields</span>
                  </label>
                </div>
              </div>
              <TemplateLibraryBrowser
                templates={templates}
                templateLibraries={templateLibraries}
                showVersionInfo={modularVersioningEnabled}
                activeTemplateId={activeTemplate.id}
                onSelectTemplate={onSelectTemplate}
                onCreateTemplate={onCreateTemplate}
                onMoveTemplate={onMoveTemplate}
                onAddTemplateComponent={profileIncludes('modular') ? addTemplateComponent : undefined}
                canAddTemplateComponent={canAddTemplateAsComponent}
                onCreateLibrary={(name, parentId) => {
                  const newLibrary: TemplateLibrary = {
                    id: generateId(),
                    name,
                    description: '',
                    parentId,
                  };
                  onSaveTemplateLibrary(newLibrary);
                }}
                onMoveLibrary={onMoveTemplateLibrary}
                onDeleteTemplate={onDeleteTemplate}
                onDeleteLibrary={onDeleteTemplateLibrary}
                searchQuery={searchTemplates ? librarySearchQuery : ''}
              />
              <FieldLibraryBrowser
                customFields={customFields}
                customFieldVersions={customFieldVersions}
                showVersionInfo={modularVersioningEnabled}
                fieldLibraries={fieldLibraries}
                disableAddActions={isTemplateReadOnlyInProfile}
                onAddField={(type, customFieldTypeId, libraryId, customFieldVersion) => {
                  if (isTemplateReadOnlyInProfile) return;
                  addField(type, customFieldTypeId, libraryId, customFieldVersion);
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
                showSemanticStandardFields={semanticEnabled}
                onCreateFieldType={(libraryId) => {
                  setCreateFieldForLibraryId(libraryId);
                  setEditingFieldType(null);
                  setIsCreateFieldModalOpen(true);
                }}
                onMoveFieldType={onMoveCustomField}
                onMoveLibrary={onMoveFieldLibrary}
                onEditFieldType={(fieldType) => {
                  setEditingFieldType(fieldType);
                  setIsCreateFieldModalOpen(true);
                }}
                highlightedFieldType={focusedFieldId ? (() => {
                  const field = schema.fields.find((f) => f.id === focusedFieldId);
                  if (!field) return null;
                  return {
                    type: field.type,
                    customFieldTypeId: field.customFieldTypeId,
                    libraryId: field.libraryId,
                  };
                })() : null}
                searchQuery={searchFields ? librarySearchQuery : ''}
              />
            </div>
          </div>
          <div className="split-panel builder-panel">
            <div className="split-panel-header builder-panel-header">
              <span className="builder-panel-title">Builder</span>
              <div className="builder-panel-controls">
                {renderHistoryControls()}
                {modularVersioningEnabled && renderVersionControl()}
              </div>
            </div>
            <main className="form-canvas">
              {isTemplateReadOnlyInProfile && (
                <div className="template-read-only-banner" role="status">
                  This template references {outdatedFieldVersionCount} non-latest {staleFieldVersionLabel}.
                  Switch to the Modular profile to edit it.
                </div>
              )}
              <div className="form-meta">
                <div className="template-options-row">
                  <div className="template-more-options-container">
                    <button
                      type="button"
                      className={`template-more-options-trigger ${isTemplateOptionsOpen ? 'is-open' : ''}`}
                      onClick={() => setIsTemplateOptionsOpen((prev) => !prev)}
                    >
                      More Options
                      <span className="dropdown-arrow">{isTemplateOptionsOpen ? '▲' : '▼'}</span>
                    </button>
                    {isTemplateOptionsOpen && (
                      <div className="template-more-options-dropdown">
                        <label className="template-more-options-checkbox">
                          <input
                            type="checkbox"
                            checked={templateDisplayOptions.showDescription}
                            onChange={() => toggleTemplateDisplayOption('showDescription')}
                          />
                          <span>Show Description</span>
                        </label>
                        <label className="template-more-options-checkbox">
                          <input
                            type="checkbox"
                            checked={templateDisplayOptions.showIri}
                            disabled={!semanticEnabled}
                            onChange={() => toggleTemplateDisplayOption('showIri')}
                          />
                          <span>
                            Show Template IRI
                            {!semanticEnabled ? ' (Semantic/Modular only)' : ''}
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  className="form-title-input"
                  value={schema.title}
                  disabled={isTemplateReadOnlyInProfile}
                  onChange={(e) =>
                    setSchema(
                      (prev) => ({ ...prev, title: e.target.value }),
                      'text',
                      `template:${schema.id}:title`,
                    )
                  }
                  placeholder="Template Title"
                />
                {semanticEnabled && templateDisplayOptions.showIri && (
                  <div className="semantic-iri-row">
                    <label htmlFor="template-name-iri-input">Template Name IRI</label>
                    <div className="iri-inline-row">
                      <input
                        id="template-name-iri-input"
                        type="text"
                        className="semantic-iri-input"
                        value={schema.nameIri || ''}
                        disabled={isTemplateReadOnlyInProfile}
                        onChange={(e) => {
                          const nextIri = e.target.value;
                          setSchema((prev) => ({
                            ...prev,
                            nameIri: nextIri,
                            nameIriLabel: nextIri === prev.nameIri ? prev.nameIriLabel : '',
                          }), 'text', `template:${schema.id}:nameIri`);
                        }}
                        placeholder="https://example.org/iri/template-name"
                      />
                      {schema.nameIri && schema.nameIriLabel && (
                        <span className="iri-label-chip" title={schema.nameIri}>
                          {schema.nameIriLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {templateDisplayOptions.showDescription && (
                  <textarea
                    className="form-description-input"
                    value={schema.description}
                    disabled={isTemplateReadOnlyInProfile}
                    onChange={(e) =>
                      setSchema(
                        (prev) => ({ ...prev, description: e.target.value }),
                        'text',
                        `template:${schema.id}:description`,
                      )
                    }
                    placeholder="Add a description for your template (optional)"
                    rows={2}
                  />
                )}
              </div>

              <div className={`fields-list ${draggedFieldId ? 'dragging-mode' : ''}`}>
                {schema.fields.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📝</span>
                    <h3>Start building your template</h3>
                    <p>Select a field from the library to add it.</p>
                  </div>
                ) : (
                  <>
                    {schema.fields.map((field, index) => {
                      const isDragging = draggedFieldId === field.id;
                      const draggedIndex = schema.fields.findIndex(f => f.id === draggedFieldId);
                      const showDropBefore = draggedFieldId && 
                        dropTargetIndex === index &&
                        index !== draggedIndex &&
                        index !== draggedIndex + 1;

                      return (
                        <div key={field.id}>
                          {showDropBefore && (
                            <div className="drop-indicator">
                              <span className="drop-indicator-line"></span>
                            </div>
                          )}
                          <div
                            className={`field-drag-wrapper ${isDragging ? 'is-dragging' : ''}`}
                            draggable={!isTemplateReadOnlyInProfile}
                            onDragStart={(e) => {
                              if (isTemplateReadOnlyInProfile) return;
                              e.dataTransfer.effectAllowed = 'move';
                              handleDragStart(field.id);
                            }}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                          >
                            <FieldEditor
                              field={field}
                              position={index + 1}
                              onUpdate={updateField}
                              onDelete={deleteField}
                              isFocused={focusedFieldId === field.id}
                              onFocus={() => setFocusedFieldId(field.id)}
                              onBlur={() => setFocusedFieldId(null)}
                              customFields={customFields}
                              customFieldVersions={customFieldVersions}
                              fieldLibraries={fieldLibraries}
                              templates={templates}
                              templateVersions={templateVersions}
                              currentTemplateId={schema.id}
                              showSemanticFields={semanticEnabled}
                              showVersionControls={modularVersioningEnabled}
                              isReadOnly={isTemplateReadOnlyInProfile}
                              onEditFieldType={(fieldType) => {
                                setEditingFieldType(fieldType);
                                setIsCreateFieldModalOpen(true);
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {/* Drop zone at the end of the list */}
                    {draggedFieldId && (
                      <div
                        className={`drop-zone-end ${dropTargetIndex === schema.fields.length ? 'active' : ''}`}
                        onDragOver={(e) => handleDragOver(e, schema.fields.length)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, schema.fields.length)}
                      >
                        {dropTargetIndex === schema.fields.length && (
                          <div className="drop-indicator">
                            <span className="drop-indicator-line"></span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </main>
          </div>
          <div className="split-panel preview-panel">
            <div className="split-panel-header">Preview</div>
            <div className="preview-layout">
              <FormPreview
                schema={schema}
                focusedFieldId={focusedFieldId}
                templates={templates}
                templateVersions={templateVersions}
                showVersionInfo={modularVersioningEnabled}
              />
            </div>
          </div>
        </div>

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
        onSave={(field) => onSaveCustomField(field, activeProfile)}
        fieldLibraries={fieldLibraries}
        enableSemanticFeatures={semanticEnabled}
        preSelectedLibraryId={createFieldForLibraryId}
        editingField={editingFieldType}
      />
    </div>
  );
}
