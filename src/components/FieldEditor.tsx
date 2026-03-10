import { useMemo, useState } from 'react';
import type {
  CustomFieldType,
  CustomFieldVersion,
  FieldLibrary,
  FieldType,
  FormField,
  OntologyClassOption,
  OntologyOptionSource,
  FormSchema,
  TemplateVersion,
} from '../types';
import { FIELD_TYPES } from './FormBuilder';
import { OntologyIriPickerModal } from './OntologyIriPickerModal';

const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const basePath = import.meta.env.BASE_URL || '/';

interface OntologyPickerSelection {
  iri: string;
  label: string;
  hasChildren?: boolean;
  childrenKey?: string;
  ontologyId?: string;
}

const normalizePath = (path: string): string => path.replace(/^\/+/, '');
const normalizeBasePath = (path: string): string =>
  path.endsWith('/') ? path : `${path}/`;

const toAssetUrls = (path: string): string[] => {
  const normalizedPath = normalizePath(path);
  const normalizedBasePath = normalizeBasePath(basePath);
  return Array.from(new Set([
    `${normalizedBasePath}${normalizedPath}`,
    `/${normalizedPath}`,
    `./${normalizedPath}`,
    normalizedPath,
  ]));
};

const toSha1Hex = async (input: string): Promise<string | null> => {
  if (!globalThis.crypto?.subtle) return null;
  const encoded = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-1', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const cloneOntologyOptions = (options: OntologyClassOption[]): OntologyClassOption[] =>
  options.map((option) => ({ ...option }));

const cloneOntologySources = (sources: OntologyOptionSource[]): OntologyOptionSource[] =>
  sources.map((source) => ({
    ...source,
    options: cloneOntologyOptions(source.options || []),
  }));

const sourcesFromOptions = (options?: OntologyClassOption[]): OntologyOptionSource[] =>
  (options || []).map((option) => ({
    mode: 'single',
    iri: option.iri,
    label: option.label,
    options: [{ ...option }],
  }));

const flattenOntologySources = (sources: OntologyOptionSource[]): OntologyClassOption[] => {
  const byIri = new Map<string, OntologyClassOption>();
  sources.forEach((source) => {
    source.options.forEach((option) => {
      if (!byIri.has(option.iri)) {
        byIri.set(option.iri, { ...option });
      }
    });
  });
  return Array.from(byIri.values());
};

const fetchOntologyChildNodes = async (
  selection: OntologyPickerSelection,
): Promise<OntologyPickerSelection[]> => {
  const iri = selection.iri;
  const ontologyIds = Array.from(new Set([
    selection.ontologyId,
    selection.ontologyId?.toLowerCase(),
    selection.ontologyId?.toUpperCase(),
    'obi',
    'OBI',
  ].filter((value): value is string => Boolean(value && value.trim()))));
  const keyCandidates = new Set<string>();
  if (selection.childrenKey && selection.childrenKey.trim()) {
    keyCandidates.add(selection.childrenKey);
  }
  const sha1Key = await toSha1Hex(iri);
  if (sha1Key) {
    keyCandidates.add(sha1Key);
  }

  for (const ontologyId of ontologyIds) {
    for (const key of keyCandidates) {
      const candidateUrls = toAssetUrls(`ontology-children/${ontologyId}/${key}.json`);
      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, { cache: 'no-cache' });
          if (response.status === 404) {
            continue;
          }
          if (!response.ok) {
            continue;
          }
          const payload = (await response.json()) as {
            children?: Array<{
              iri?: string;
              label?: string;
              hasChildren?: boolean;
              childrenKey?: string;
            }>;
          };
          return (payload.children || [])
            .filter((child) => child.iri)
            .map((child) => ({
              iri: child.iri!,
              label: child.label?.trim() || child.iri!,
              hasChildren: child.hasChildren,
              childrenKey: child.childrenKey,
              ontologyId,
            }));
        } catch {
          // Continue trying fallback URLs.
        }
      }
    }
  }

  return [];
};

const fetchImmediateChildren = async (
  selection: OntologyPickerSelection,
): Promise<OntologyClassOption[]> => {
  const childNodes = await fetchOntologyChildNodes(selection);
  return childNodes.map((child) => ({ iri: child.iri, label: child.label }));
};

const fetchBranchChildren = async (
  selection: OntologyPickerSelection,
): Promise<OntologyClassOption[]> => {
  const byIri = new Map<string, OntologyClassOption>();
  const visitedParents = new Set<string>();
  const queue: OntologyPickerSelection[] = [selection];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    if (visitedParents.has(current.iri)) continue;
    visitedParents.add(current.iri);

    const children = await fetchOntologyChildNodes(current);
    children.forEach((child) => {
      if (!byIri.has(child.iri)) {
        byIri.set(child.iri, { iri: child.iri, label: child.label });
      }
      if (child.hasChildren !== false && !visitedParents.has(child.iri)) {
        queue.push(child);
      }
    });
  }

  return Array.from(byIri.values()).sort((a, b) => a.label.localeCompare(b.label));
};

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
  isReadOnly?: boolean;
  onEditFieldType?: (fieldType: CustomFieldType) => void;
}

export function FieldEditor({
  field,
  position,
  onUpdate: onUpdateProp,
  onDelete: onDeleteProp,
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
  isReadOnly = false,
  onEditFieldType,
}: FieldEditorProps) {
  const [isOntologyPickerOpen, setIsOntologyPickerOpen] = useState(false);
  const [isOntologyOptionPickerOpen, setIsOntologyOptionPickerOpen] = useState(false);
  const [ontologyOptionSelectionMode, setOntologyOptionSelectionMode] = useState<'single' | 'children' | 'branch'>('single');
  const [ontologyOptionStatus, setOntologyOptionStatus] = useState<string | null>(null);
  const [isLoadingOntologyOptionSource, setIsLoadingOntologyOptionSource] = useState(false);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState(false);
  const [fieldDisplayOptions, setFieldDisplayOptions] = useState({
    showPlaceholderInput: false,
    showDescriptionInput: false,
    showIriInput: false,
  });
  const onUpdate = (nextField: FormField) => {
    if (isReadOnly) return;
    onUpdateProp(nextField);
  };
  const onDelete = (id: string) => {
    if (isReadOnly) return;
    onDeleteProp(id);
  };

  // Get library fields based on the field's own libraryId (not the global selection)
  const fieldLibraryId = field.libraryId;
  const libraryFields = fieldLibraryId 
    ? customFields.filter(cf => cf.libraryIds?.includes(fieldLibraryId))
    : [];
  
  const isLibraryField = fieldLibraryId && libraryFields.length > 0;
  const isTemplateComponentField = field.type === 'template';
  const availableTemplates = templates.filter((template) => template.id !== currentTemplateId);
  const availableStandardFieldTypes = useMemo(
    () => {
      if (showSemanticFields) return FIELD_TYPES;

      const basicTypes = FIELD_TYPES.filter((fieldType) => fieldType.type !== 'ontology-select');
      if (field.type === 'ontology-select') {
        const ontologyType = FIELD_TYPES.find((fieldType) => fieldType.type === 'ontology-select');
        return ontologyType ? [...basicTypes, ontologyType] : basicTypes;
      }
      return basicTypes;
    },
    [showSemanticFields, field.type],
  );

  const handleTypeChange = (value: string) => {
    if (isLibraryField) {
      // Value is a custom field ID
      const customField = customFields.find(cf => cf.id === value);
      if (customField) {
        const ontologySources = customField.baseType === 'ontology-select'
          ? cloneOntologySources(
            customField.ontologyOptionSources && customField.ontologyOptionSources.length > 0
              ? customField.ontologyOptionSources
              : sourcesFromOptions(customField.ontologyOptions || field.ontologyOptions),
          )
          : [];
        const updatedField: FormField = {
          ...field,
          type: customField.baseType,
          customFieldTypeId: customField.id,
          customFieldVersion: customField.version,
          description: customField.description || '',
          options: customField.baseType === 'select' ? (field.options || ['Option 1', 'Option 2', 'Option 3']) : undefined,
          ontologyOptions: customField.baseType === 'ontology-select' ? flattenOntologySources(ontologySources) : undefined,
          ontologyOptionSources: customField.baseType === 'ontology-select' ? ontologySources : undefined,
          validationRules: customField.validationRules ? [...customField.validationRules] : undefined,
        };
        onUpdate(updatedField);
      }
    } else {
      // Value is a standard field type
      const newType = value as FieldType;
      const ontologySources = newType === 'ontology-select'
        ? cloneOntologySources(effectiveOntologyOptionSources)
        : [];
      const updatedField: FormField = {
        ...field,
        type: newType,
        customFieldTypeId: undefined,
        customFieldVersion: undefined,
        options: newType === 'select' ? (field.options || ['Option 1', 'Option 2', 'Option 3']) : undefined,
        ontologyOptions: newType === 'ontology-select' ? flattenOntologySources(ontologySources) : undefined,
        ontologyOptionSources: newType === 'ontology-select' ? ontologySources : undefined,
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
  const effectiveOntologyOptionSources = useMemo(
    () =>
      field.ontologyOptionSources && field.ontologyOptionSources.length > 0
        ? cloneOntologySources(field.ontologyOptionSources)
        : sourcesFromOptions(field.ontologyOptions),
    [field.ontologyOptionSources, field.ontologyOptions],
  );
  const toggleDisplayOption = (
    option: 'showPlaceholderInput' | 'showDescriptionInput' | 'showIriInput',
  ) => {
    setFieldDisplayOptions((prev) => ({
      ...prev,
      [option]: !prev[option],
    }));
  };

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
      <fieldset className="field-editor-fieldset">
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
              disabled={isReadOnly}
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
                availableStandardFieldTypes.map(({ type, label, icon }) => (
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
              disabled={isReadOnly}
              onChange={(e) => {
                const version = Number(e.target.value);
                const selectedVersion = customFieldVersionHistory.find((item) => item.version === version);
                if (!selectedVersion) return;
                const snapshot = selectedVersion.snapshot;
                const ontologySources = snapshot.baseType === 'ontology-select'
                  ? cloneOntologySources(
                    snapshot.ontologyOptionSources && snapshot.ontologyOptionSources.length > 0
                      ? snapshot.ontologyOptionSources
                      : sourcesFromOptions(snapshot.ontologyOptions || field.ontologyOptions),
                  )
                  : [];
                onUpdate({
                  ...field,
                  type: snapshot.baseType,
                  customFieldVersion: selectedVersion.version,
                  description: snapshot.description || '',
                  options: snapshot.baseType === 'select' ? (field.options || ['Option 1', 'Option 2', 'Option 3']) : undefined,
                  ontologyOptions: snapshot.baseType === 'ontology-select' ? flattenOntologySources(ontologySources) : undefined,
                  ontologyOptionSources: snapshot.baseType === 'ontology-select' ? ontologySources : undefined,
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
              disabled={isReadOnly}
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
            disabled={isReadOnly}
            onChange={(e) => onUpdate({ ...field, label: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder={isTemplateComponentField ? 'Component Name' : 'Untitled Field'}
          />
        </div>
        <div className="field-editor-actions">
          <div className="field-more-options-container">
            <button
              type="button"
              className={`field-more-options-trigger ${isMoreOptionsOpen ? 'is-open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsMoreOptionsOpen((prev) => !prev);
              }}
            >
              More Options
              <span className="dropdown-arrow">{isMoreOptionsOpen ? '▲' : '▼'}</span>
            </button>
            {isMoreOptionsOpen && (
              <div className="field-more-options-dropdown" onClick={(e) => e.stopPropagation()}>
                {!isTemplateComponentField && (
                  <label className="field-more-options-checkbox">
                    <input
                      type="checkbox"
                      checked={fieldDisplayOptions.showPlaceholderInput}
                      onChange={() => toggleDisplayOption('showPlaceholderInput')}
                    />
                    <span>Placeholder Text</span>
                  </label>
                )}
                {!isTemplateComponentField && (
                  <label className="field-more-options-checkbox">
                    <input
                      type="checkbox"
                      checked={fieldDisplayOptions.showDescriptionInput}
                      onChange={() => toggleDisplayOption('showDescriptionInput')}
                    />
                    <span>Description</span>
                  </label>
                )}
                <label className="field-more-options-checkbox">
                  <input
                    type="checkbox"
                    checked={fieldDisplayOptions.showIriInput}
                    disabled={!showSemanticFields}
                    onChange={() => toggleDisplayOption('showIriInput')}
                  />
                  <span>
                    IRI
                    {!showSemanticFields ? ' (Semantic/Modular only)' : ''}
                  </span>
                </label>
              </div>
            )}
          </div>
          {isReadOnly && <span className="field-read-only-pill">Read only</span>}
          <span className={`drag-handle ${isReadOnly ? 'is-disabled' : ''}`} title="Drag to reorder">⠿</span>
          <button
            className="icon-button delete"
            onClick={(e) => { e.stopPropagation(); onDelete(field.id); }}
            title="Delete field"
            disabled={isReadOnly}
          >
            ×
          </button>
        </div>
      </div>

      <div className="field-editor-body">
          {showSemanticFields && fieldDisplayOptions.showIriInput && (
            <div className="form-group">
              <label>Field Name IRI</label>
              <div className="iri-input-row">
                <input
                  type="text"
                  value={field.nameIri || ''}
                  disabled={isReadOnly}
                  onChange={(e) => {
                    const nextIri = e.target.value;
                    onUpdate({
                      ...field,
                      nameIri: nextIri,
                      nameIriLabel: nextIri === field.nameIri ? field.nameIriLabel : '',
                    });
                  }}
                  placeholder="https://example.org/iri/field-name"
                />
                {field.nameIri && field.nameIriLabel && (
                  <span className="iri-label-chip" title={field.nameIri}>
                    {field.nameIriLabel}
                  </span>
                )}
                <button
                  type="button"
                  className="iri-picker-button"
                  disabled={isReadOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOntologyPickerOpen(true);
                  }}
                >
                  Pick from Ontology
                </button>
              </div>
              <span className="input-hint">Paste an IRI to semantically identify this field name.</span>
            </div>
          )}
          {isTemplateComponentField ? (
            <div className="form-group">
              <label>Referenced Template</label>
              <select
                value={field.componentTemplateId || ''}
                disabled={isReadOnly}
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
                    disabled={isReadOnly}
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
          {(fieldDisplayOptions.showPlaceholderInput || fieldDisplayOptions.showDescriptionInput) && (
            <div className="field-detail-row">
              {fieldDisplayOptions.showPlaceholderInput && (
                <div className="form-group">
                  <label>Placeholder Text</label>
                  <input
                    type="text"
                    value={field.placeholder || ''}
                    disabled={isReadOnly}
                    onChange={(e) => onUpdate({ ...field, placeholder: e.target.value })}
                    placeholder="Enter placeholder text..."
                  />
                </div>
              )}
              {fieldDisplayOptions.showDescriptionInput && (
                <div className="form-group">
                  <label>Field Description</label>
                  <input
                    type="text"
                    value={field.description || ''}
                    disabled={isReadOnly}
                    onChange={(e) => onUpdate({ ...field, description: e.target.value })}
                    placeholder="Short description for tooltip..."
                  />
                </div>
              )}
            </div>
          )}

          {field.type === 'select' && (
            <div className="form-group">
              <label>Options (one per line)</label>
              <textarea
                value={(field.options || []).join('\n')}
                disabled={isReadOnly}
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
          {field.type === 'ontology-select' && (
            <div className="form-group">
              <label>Ontology Option Sources</label>
              <div className="ontology-options-toolbar">
                <button
                  type="button"
                  className="iri-picker-button"
                  disabled={isReadOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOntologyOptionSelectionMode('single');
                    setIsOntologyOptionPickerOpen(true);
                  }}
                >
                  Add Ontology Class
                </button>
                <button
                  type="button"
                  className="iri-picker-button"
                  disabled={isReadOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOntologyOptionSelectionMode('children');
                    setIsOntologyOptionPickerOpen(true);
                  }}
                >
                  Add Immediate Children
                </button>
                <button
                  type="button"
                  className="iri-picker-button"
                  disabled={isReadOnly}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOntologyOptionSelectionMode('branch');
                    setIsOntologyOptionPickerOpen(true);
                  }}
                >
                  Add Branch
                </button>
              </div>
              {isLoadingOntologyOptionSource && (
                <span className="input-hint">
                  {ontologyOptionSelectionMode === 'branch'
                    ? 'Loading branch descendants...'
                    : 'Loading immediate children...'}
                </span>
              )}
              {ontologyOptionStatus && (
                <span className="input-hint">{ontologyOptionStatus}</span>
              )}
              {effectiveOntologyOptionSources.length === 0 ? (
                <span className="input-hint">No ontology option source configured yet.</span>
              ) : (
                <div className="ontology-option-list">
                  {effectiveOntologyOptionSources.map((source) => (
                    <div key={`${source.mode}:${source.iri}`} className="ontology-option-item">
                      <div className="ontology-option-text">
                        <span className="ontology-option-label">
                          {source.mode === 'children'
                            ? `All immediate children of ${source.label}`
                            : source.mode === 'branch'
                              ? `Branch (all descendants) of ${source.label}`
                              : source.label}
                        </span>
                        <span className="ontology-option-iri">{source.iri}</span>
                        {(source.mode === 'children' || source.mode === 'branch') && (
                          <span className="input-hint">
                            {source.options.length} {source.mode === 'branch' ? 'descendant' : 'direct child'} option{source.options.length === 1 ? '' : 's'}.
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="ontology-option-remove"
                        disabled={isReadOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextSources = effectiveOntologyOptionSources.filter(
                            (item) => !(item.mode === source.mode && item.iri === source.iri),
                          );
                          onUpdate({
                            ...field,
                            ontologyOptionSources: nextSources,
                            ontologyOptions: flattenOntologySources(nextSources),
                          });
                        }}
                        title={`Remove ${source.label}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="form-group-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={field.required}
                disabled={isReadOnly}
                onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
              />
              <span>Required</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={field.multiple}
                disabled={isReadOnly}
                onChange={(e) => onUpdate({ ...field, multiple: e.target.checked })}
              />
              <span>Allow Multiple Values</span>
            </label>
          </div>
            </>
          )}
        </div>
      </fieldset>
      <OntologyIriPickerModal
        isOpen={isOntologyPickerOpen}
        onClose={() => setIsOntologyPickerOpen(false)}
        onSelectIri={({ iri, label }) => {
          if (isReadOnly) return;
          onUpdate({ ...field, nameIri: iri, nameIriLabel: label });
        }}
      />
      <OntologyIriPickerModal
        isOpen={isOntologyOptionPickerOpen}
        onClose={() => setIsOntologyOptionPickerOpen(false)}
        onSelectIri={async (selection: OntologyPickerSelection) => {
          if (isReadOnly) return;
          setOntologyOptionStatus(null);

          if (ontologyOptionSelectionMode === 'children' || ontologyOptionSelectionMode === 'branch') {
            setIsLoadingOntologyOptionSource(true);
            const sourceOptions = ontologyOptionSelectionMode === 'branch'
              ? await fetchBranchChildren(selection)
              : await fetchImmediateChildren(selection);
            setIsLoadingOntologyOptionSource(false);

            const source: OntologyOptionSource = {
              mode: ontologyOptionSelectionMode,
              iri: selection.iri,
              label: selection.label,
              options: sourceOptions,
            };

            if (
              effectiveOntologyOptionSources.some(
                (existingSource) =>
                  existingSource.mode === ontologyOptionSelectionMode &&
                  existingSource.iri === selection.iri,
              )
            ) {
              setOntologyOptionStatus(
                ontologyOptionSelectionMode === 'branch'
                  ? `Branch of ${selection.label} is already configured.`
                  : `Immediate children of ${selection.label} are already configured.`,
              );
              return;
            }

            const nextSources = [...effectiveOntologyOptionSources, source];
            onUpdate({
              ...field,
              ontologyOptionSources: nextSources,
              ontologyOptions: flattenOntologySources(nextSources),
            });
            setOntologyOptionStatus(
              sourceOptions.length > 0
                ? ontologyOptionSelectionMode === 'branch'
                  ? `Configured full branch (all descendants) of ${selection.label}.`
                  : `Configured all immediate children of ${selection.label}.`
                : ontologyOptionSelectionMode === 'branch'
                  ? `${selection.label} has no descendants.`
                  : `${selection.label} has no immediate children.`,
            );
            return;
          }

          const singleSource: OntologyOptionSource = {
            mode: 'single',
            iri: selection.iri,
            label: selection.label,
            options: [{ iri: selection.iri, label: selection.label }],
          };

          if (effectiveOntologyOptionSources.some((source) => source.mode === 'single' && source.iri === selection.iri)) {
            setOntologyOptionStatus(`${selection.label} is already configured.`);
            return;
          }

          const nextSources = [...effectiveOntologyOptionSources, singleSource];
          onUpdate({
            ...field,
            ontologyOptionSources: nextSources,
            ontologyOptions: flattenOntologySources(nextSources),
          });
        }}
      />
    </div>
  );
}
