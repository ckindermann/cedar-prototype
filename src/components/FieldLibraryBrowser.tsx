import { useState, useMemo, useEffect } from 'react';
import type { CustomFieldType, CustomFieldVersion, FieldLibrary, FieldType } from '../types';
import { FIELD_TYPES } from './FormBuilder';

interface FieldLibraryBrowserProps {
  customFields: CustomFieldType[];
  customFieldVersions: Record<string, CustomFieldVersion[]>;
  showVersionInfo?: boolean;
  fieldLibraries: FieldLibrary[];
  disableAddActions?: boolean;
  onAddField: (type: FieldType, customFieldTypeId?: string, libraryId?: string, customFieldVersion?: number) => void;
  onCreateLibrary: (name: string, parentId?: string) => void;
  onCreateFieldType: (libraryId: string) => void;
  onMoveFieldType: (fieldTypeId: string, targetLibraryId?: string) => void;
  onMoveLibrary: (libraryId: string, targetParentId?: string) => void;
  onEditFieldType?: (fieldType: CustomFieldType) => void;
  highlightedFieldType?: { type: FieldType; customFieldTypeId?: string; libraryId?: string } | null;
  searchQuery: string;
  showSemanticStandardFields?: boolean;
}

interface LibraryNode {
  library: FieldLibrary;
  children: LibraryNode[];
  fields: CustomFieldType[];
}

type DraggedFieldItem =
  | { type: 'field'; id: string }
  | { type: 'library'; id: string };

export function FieldLibraryBrowser({
  customFields,
  customFieldVersions,
  showVersionInfo = false,
  fieldLibraries,
  disableAddActions = false,
  onAddField,
  onCreateLibrary,
  onCreateFieldType,
  onMoveFieldType,
  onMoveLibrary,
  onEditFieldType,
  highlightedFieldType,
  searchQuery,
  showSemanticStandardFields = false,
}: FieldLibraryBrowserProps) {
  const [expandedLibraries, setExpandedLibraries] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedField, setSelectedField] = useState<{
    field: CustomFieldType | { type: FieldType; label: string; icon: string };
    libraryId: string | null;
    isStandard: boolean;
  } | null>(null);
  const [isStandardExpanded, setIsStandardExpanded] = useState(true);
  const [isCreatingLibrary, setIsCreatingLibrary] = useState<string | null>(null); // null = not creating, 'root' = root level, libraryId = sub-library
  const [newLibraryName, setNewLibraryName] = useState('');
  const [draggedItem, setDraggedItem] = useState<DraggedFieldItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [inspectorFieldId, setInspectorFieldId] = useState<string | null>(null);
  const [inspectorVersion, setInspectorVersion] = useState<number | null>(null);
  const standardFieldTypes = useMemo(
    () =>
      showSemanticStandardFields
        ? FIELD_TYPES
        : FIELD_TYPES.filter((fieldType) => fieldType.type !== 'ontology-select'),
    [showSemanticStandardFields],
  );

  // Auto-expand library containing highlighted field
  useEffect(() => {
    if (highlightedFieldType?.libraryId) {
      setExpandedLibraries(prev => new Set([...prev, highlightedFieldType.libraryId!]));
    }
  }, [highlightedFieldType]);

  useEffect(() => {
    if (!showVersionInfo) {
      setInspectorFieldId(null);
      setInspectorVersion(null);
    }
  }, [showVersionInfo]);

  // Check if a field type matches the highlighted one
  const isHighlighted = (fieldType: FieldType, customFieldId?: string, isStandard?: boolean) => {
    if (!highlightedFieldType) return false;
    
    if (isStandard && !highlightedFieldType.customFieldTypeId) {
      return highlightedFieldType.type === fieldType;
    }
    
    if (customFieldId && highlightedFieldType.customFieldTypeId) {
      return highlightedFieldType.customFieldTypeId === customFieldId;
    }
    
    return false;
  };

  // Build hierarchical library structure
  const libraryTree = useMemo(() => {
    const rootLibraries: LibraryNode[] = [];
    const libraryMap = new Map<string, LibraryNode>();

    // First pass: create nodes for all libraries
    fieldLibraries.forEach(library => {
      const fields = customFields
        .filter(cf => cf.libraryIds?.includes(library.id))
        .sort((a, b) => a.name.localeCompare(b.name));
      libraryMap.set(library.id, {
        library,
        children: [],
        fields,
      });
    });

    // Second pass: build tree structure
    fieldLibraries.forEach(library => {
      const node = libraryMap.get(library.id)!;
      if (library.parentId && libraryMap.has(library.parentId)) {
        libraryMap.get(library.parentId)!.children.push(node);
      } else {
        rootLibraries.push(node);
      }
    });

    // Sort libraries and their children alphabetically
    const sortNodes = (nodes: LibraryNode[]) => {
      nodes.sort((a, b) => a.library.name.localeCompare(b.library.name));
      nodes.forEach(node => sortNodes(node.children));
    };
    sortNodes(rootLibraries);

    return rootLibraries;
  }, [fieldLibraries, customFields]);

  // Filter fields based on search query
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    const results: Array<{
      field: CustomFieldType | { type: FieldType; label: string; icon: string };
      libraryId: string | null;
      libraryName: string;
      isStandard: boolean;
    }> = [];

    // Search standard fields
    standardFieldTypes.forEach(fieldType => {
      if (fieldType.label.toLowerCase().includes(query) || 
          fieldType.type.toLowerCase().includes(query)) {
        results.push({
          field: fieldType,
          libraryId: null,
          libraryName: 'Standard',
          isStandard: true,
        });
      }
    });

    // Search custom fields
    customFields.forEach(field => {
      if (field.name.toLowerCase().includes(query) ||
          field.description?.toLowerCase().includes(query)) {
        const libraryId = field.libraryIds?.[0] || null;
        const library = libraryId ? fieldLibraries.find(l => l.id === libraryId) : null;
        results.push({
          field,
          libraryId,
          libraryName: library?.name || 'Unassigned',
          isStandard: false,
        });
      }
    });

    results.sort((a, b) => {
      const nameA = a.isStandard ? (a.field as { label: string }).label : (a.field as CustomFieldType).name;
      const nameB = b.isStandard ? (b.field as { label: string }).label : (b.field as CustomFieldType).name;
      return nameA.localeCompare(nameB);
    });

    return results;
  }, [searchQuery, customFields, fieldLibraries, standardFieldTypes]);

  const toggleLibrary = (libraryId: string) => {
    setExpandedLibraries(prev => {
      const next = new Set(prev);
      if (next.has(libraryId)) {
        next.delete(libraryId);
      } else {
        next.add(libraryId);
      }
      return next;
    });
  };

  const handleAddField = (
    field: CustomFieldType | { type: FieldType; label: string; icon: string },
    isStandard: boolean,
    libraryId: string | null,
  ) => {
    if (disableAddActions) return;
    if (isStandard) {
      const standardField = field as { type: FieldType; label: string; icon: string };
      onAddField(standardField.type);
    } else {
      const customField = field as CustomFieldType;
      onAddField(customField.baseType, customField.id, libraryId || undefined, customField.version);
    }
  };

  const handleStartCreateLibrary = (parentId: string | null) => {
    setIsCreatingLibrary(parentId || 'root');
    setNewLibraryName('');
    // Auto-expand the parent if creating a sub-library
    if (parentId) {
      setExpandedLibraries(prev => new Set([...prev, parentId]));
    }
  };

  const handleCreateLibrary = () => {
    if (!newLibraryName.trim()) {
      setIsCreatingLibrary(null);
      return;
    }
    
    const parentId = isCreatingLibrary === 'root' ? undefined : isCreatingLibrary || undefined;
    onCreateLibrary(newLibraryName.trim(), parentId);
    setNewLibraryName('');
    setIsCreatingLibrary(null);
  };

  const handleCancelCreateLibrary = () => {
    setIsCreatingLibrary(null);
    setNewLibraryName('');
  };

  const formatSavedAt = (savedAt: string): string => {
    if (!savedAt) return 'Unknown date';
    return new Date(savedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getVersionHistory = (field: CustomFieldType): CustomFieldVersion[] => {
    const history = customFieldVersions[field.id] || [];
    if (history.length === 0) {
      return [{
        version: field.version,
        savedAt: '',
        snapshot: field,
      }];
    }
    return [...history].sort((a, b) => b.version - a.version);
  };

  const openVersionInspector = (field: CustomFieldType) => {
    const history = getVersionHistory(field);
    setInspectorFieldId(field.id);
    setInspectorVersion(history[0]?.version ?? field.version);
  };

  const closeVersionInspector = () => {
    setInspectorFieldId(null);
    setInspectorVersion(null);
  };

  const inspectorField = inspectorFieldId
    ? customFields.find((field) => field.id === inspectorFieldId) || null
    : null;
  const inspectorHistory = inspectorField ? getVersionHistory(inspectorField) : [];
  const selectedInspectorVersion = inspectorVersion
    ? inspectorHistory.find((item) => item.version === inspectorVersion) || inspectorHistory[0]
    : inspectorHistory[0];
  const inspectorSnapshot = selectedInspectorVersion?.snapshot;
  const inspectorLibraryNames = (inspectorSnapshot?.libraryIds || [])
    .map((libraryId) => fieldLibraries.find((library) => library.id === libraryId)?.name)
    .filter((name): name is string => Boolean(name));

  const resetDragState = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const getParentId = (libraryId: string): string | undefined => {
    return fieldLibraries.find(l => l.id === libraryId)?.parentId;
  };

  const isValidLibraryMove = (libraryId: string, targetParentId?: string): boolean => {
    if (!targetParentId) return true;
    if (libraryId === targetParentId) return false;

    let currentParentId: string | undefined = targetParentId;
    while (currentParentId) {
      if (currentParentId === libraryId) {
        return false;
      }
      currentParentId = getParentId(currentParentId);
    }
    return true;
  };

  const canDropOnLibrary = (targetLibraryId: string): boolean => {
    if (!draggedItem) return false;
    if (draggedItem.type === 'field') return true;
    return isValidLibraryMove(draggedItem.id, targetLibraryId);
  };

  const handleDropOnLibrary = (targetLibraryId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || !canDropOnLibrary(targetLibraryId)) return;

    if (draggedItem.type === 'field') {
      onMoveFieldType(draggedItem.id, targetLibraryId);
    } else {
      onMoveLibrary(draggedItem.id, targetLibraryId);
    }
    setExpandedLibraries(prev => new Set([...prev, targetLibraryId]));
    resetDragState();
  };

  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem) return;

    if (draggedItem.type === 'field') {
      onMoveFieldType(draggedItem.id, undefined);
    } else if (isValidLibraryMove(draggedItem.id, undefined)) {
      onMoveLibrary(draggedItem.id, undefined);
    }
    resetDragState();
  };

  const renderLibraryNode = (node: LibraryNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedLibraries.has(node.library.id);
    const hasContent = node.fields.length > 0 || node.children.length > 0 || isCreatingLibrary === node.library.id;
    const libraryDragKey = `library:${node.library.id}`;
    const isDraggingLibrary = draggedItem?.type === 'library' && draggedItem.id === node.library.id;

    return (
      <div key={node.library.id} className={`library-node ${isDraggingLibrary ? 'is-dragging' : ''}`}>
        <div
          className={`library-header ${dragOverTarget === libraryDragKey ? 'drag-over' : ''}`}
          onClick={() => toggleLibrary(node.library.id)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `library:${node.library.id}`);
            setDraggedItem({ type: 'library', id: node.library.id });
          }}
          onDragEnd={resetDragState}
          onDragOver={(e) => {
            if (!canDropOnLibrary(node.library.id)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverTarget(libraryDragKey);
          }}
          onDragLeave={() => {
            if (dragOverTarget === libraryDragKey) {
              setDragOverTarget(null);
            }
          }}
          onDrop={(e) => handleDropOnLibrary(node.library.id, e)}
        >
          <span className="library-toggle">{hasContent ? (isExpanded ? '▼' : '▶') : '•'}</span>
          <span className="library-icon">{isExpanded ? '📂' : '📁'}</span>
          <span className="library-node-name">{node.library.name}</span>
          <span className="library-field-count">{node.fields.length}</span>
          <div className="library-header-actions">
            <button
              className="add-field-type-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCreateFieldType(node.library.id);
              }}
              title="Create new field type"
            >
              📝
            </button>
            <button
              className="add-sublibrary-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleStartCreateLibrary(node.library.id);
              }}
              title="Create sub-folder"
            >
              📁
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="library-children">
            {/* Inline new library input */}
            {isCreatingLibrary === node.library.id && (
              <div className="new-library-input-row">
                <span className="library-icon">📁</span>
                <input
                  type="text"
                  className="new-library-input"
                  placeholder="Folder name..."
                  value={newLibraryName}
                  onChange={(e) => setNewLibraryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateLibrary();
                    if (e.key === 'Escape') handleCancelCreateLibrary();
                  }}
                  autoFocus
                />
                <button className="confirm-btn" onClick={handleCreateLibrary} title="Create">✓</button>
                <button className="cancel-btn" onClick={handleCancelCreateLibrary} title="Cancel">×</button>
              </div>
            )}

            {/* Child libraries */}
            {node.children.map(child => renderLibraryNode(child, depth + 1))}

            {/* Fields in this library */}
            {node.fields.map(field => (
              <div
                key={field.id}
                className={`field-item ${
                  selectedField && 
                  !selectedField.isStandard && 
                  (selectedField.field as CustomFieldType).id === field.id 
                    ? 'selected' 
                    : ''
                } ${isHighlighted(field.baseType, field.id, false) ? 'highlighted' : ''} ${
                  draggedItem?.type === 'field' && draggedItem.id === field.id ? 'is-dragging' : ''
                }`}
                onClick={() => setSelectedField({
                  field,
                  libraryId: node.library.id,
                  isStandard: false,
                })}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', `field:${field.id}`);
                  setDraggedItem({ type: 'field', id: field.id });
                }}
                onDragEnd={resetDragState}
              >
                <span className="field-item-icon">{field.icon}</span>
                <span className="field-item-name">{field.name}</span>
                <span className="field-item-type">
                  {showVersionInfo ? `${field.baseType} · v${field.version}` : field.baseType}
                </span>
                <div className="field-item-actions">
                  {showVersionInfo && (
                    <button
                      className="field-item-inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        openVersionInspector(field);
                      }}
                      title="Inspect field versions"
                      aria-label="Inspect field versions"
                    >
                      🕘
                    </button>
                  )}
                  {onEditFieldType && (
                    <button
                      className="field-item-edit-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditFieldType(field);
                      }}
                      title="Edit field type"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    className="field-item-add-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddField(field, false, node.library.id);
                    }}
                    title={
                      disableAddActions
                        ? 'Template is read-only in this profile'
                        : `Add ${field.name}`
                    }
                    aria-label={`Add ${field.name}`}
                    disabled={disableAddActions}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}

            {node.fields.length === 0 && node.children.length === 0 && isCreatingLibrary !== node.library.id && (
              <div className="no-results" style={{ padding: '16px' }}>
                No fields in this library
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`library-browser ${isCollapsed ? 'collapsed' : ''}`}>
      <div
        className={`library-browser-header ${dragOverTarget === 'root' ? 'drag-over' : ''}`}
        onDragOver={(e) => {
          if (!draggedItem) return;
          if (draggedItem.type === 'library' && !isValidLibraryMove(draggedItem.id, undefined)) {
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOverTarget('root');
        }}
        onDragLeave={() => {
          if (dragOverTarget === 'root') {
            setDragOverTarget(null);
          }
        }}
        onDrop={handleDropOnRoot}
      >
        <div className="library-header-row">
          <h3
            className="library-title-toggle"
            onClick={() => setIsCollapsed((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsCollapsed((prev) => !prev);
              }
            }}
            tabIndex={0}
            role="button"
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand field library' : 'Collapse field library'}
          >
            {isCollapsed ? '▶' : '▼'} Field Library
          </h3>
          <div className="library-header-controls">
            <button
              className="new-library-btn"
              onClick={() => handleStartCreateLibrary(null)}
              title="Create new field library"
            >
              + New Library
            </button>
          </div>
        </div>
      </div>

      {!isCollapsed && <div className="library-tree">
        {filteredResults ? (
          // Search results view
          <div className="tree-section">
            <div className="search-results-header">
              {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} for "{searchQuery}"
            </div>
            {filteredResults.length === 0 ? (
              <div className="no-results">
                No fields found
              </div>
            ) : (
              filteredResults.map((result) => (
                <div
                  key={`${result.isStandard ? 'std' : 'custom'}-${result.isStandard ? (result.field as { type: FieldType }).type : (result.field as CustomFieldType).id}`}
                  className={`field-item ${
                    selectedField &&
                    ((result.isStandard && selectedField.isStandard && 
                      (selectedField.field as { type: FieldType }).type === (result.field as { type: FieldType }).type) ||
                     (!result.isStandard && !selectedField.isStandard &&
                      (selectedField.field as CustomFieldType).id === (result.field as CustomFieldType).id))
                      ? 'selected'
                      : ''
                  } ${
                    !result.isStandard &&
                    draggedItem?.type === 'field' &&
                    draggedItem.id === (result.field as CustomFieldType).id
                      ? 'is-dragging'
                      : ''
                  }`}
                  onClick={() => setSelectedField({
                    field: result.field,
                    libraryId: result.libraryId,
                    isStandard: result.isStandard,
                  })}
                  draggable={!result.isStandard}
                  onDragStart={(e) => {
                    if (result.isStandard) return;
                    const field = result.field as CustomFieldType;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', `field:${field.id}`);
                    setDraggedItem({ type: 'field', id: field.id });
                  }}
                  onDragEnd={resetDragState}
                >
                  <span className="field-item-icon">
                    {result.isStandard 
                      ? (result.field as { icon: string }).icon 
                      : (result.field as CustomFieldType).icon}
                  </span>
                  <span className="field-item-name">
                    {result.isStandard 
                      ? (result.field as { label: string }).label 
                      : (result.field as CustomFieldType).name}
                  </span>
                  <span className="field-item-type">
                    {result.isStandard
                      ? result.libraryName
                      : (showVersionInfo
                        ? `${result.libraryName} · v${(result.field as CustomFieldType).version}`
                        : result.libraryName)}
                  </span>
                  <div className="field-item-actions">
                    {!result.isStandard && showVersionInfo && (
                      <button
                        className="field-item-inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openVersionInspector(result.field as CustomFieldType);
                        }}
                        title="Inspect field versions"
                        aria-label="Inspect field versions"
                      >
                        🕘
                      </button>
                    )}
                    <button
                      className="field-item-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddField(result.field, result.isStandard, result.libraryId);
                      }}
                      title={
                        disableAddActions
                          ? 'Template is read-only in this profile'
                          : `Add ${
                            result.isStandard
                              ? (result.field as { label: string }).label
                              : (result.field as CustomFieldType).name
                          }`
                      }
                      aria-label={`Add ${
                        result.isStandard
                          ? (result.field as { label: string }).label
                          : (result.field as CustomFieldType).name
                      }`}
                      disabled={disableAddActions}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // Tree view
          <>
            {/* Standard Fields */}
            <div className="tree-section">
              <div className="library-node">
                <div
                  className="library-header"
                  onClick={() => setIsStandardExpanded(!isStandardExpanded)}
                >
                  <span className="library-toggle">{isStandardExpanded ? '▼' : '▶'}</span>
                  <span className="library-icon">📚</span>
                  <span className="library-node-name">Standard Fields</span>
                  <span className="library-field-count">{standardFieldTypes.length}</span>
                </div>

                {isStandardExpanded && (
                  <div className="library-children">
                    {standardFieldTypes.map(fieldType => (
                      <div
                        key={fieldType.type}
                        className={`field-item ${
                          selectedField?.isStandard && 
                          (selectedField.field as { type: FieldType }).type === fieldType.type 
                            ? 'selected' 
                            : ''
                        } ${isHighlighted(fieldType.type, undefined, true) ? 'highlighted' : ''}`}
                        onClick={() => setSelectedField({
                          field: fieldType,
                          libraryId: null,
                          isStandard: true,
                        })}
                      >
                        <span className="field-item-icon">{fieldType.icon}</span>
                        <span className="field-item-name">{fieldType.label}</span>
                        <span className="field-item-type">{fieldType.type}</span>
                        <div className="field-item-actions">
                          <button
                            className="field-item-add-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddField(fieldType, true, null);
                            }}
                            title={
                              disableAddActions
                                ? 'Template is read-only in this profile'
                                : `Add ${fieldType.label}`
                            }
                            aria-label={`Add ${fieldType.label}`}
                            disabled={disableAddActions}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Libraries */}
            <div className="tree-section">
              {/* Inline new root library input */}
              {isCreatingLibrary === 'root' && (
                <div className="new-library-input-row root-level">
                  <span className="library-icon">📁</span>
                  <input
                    type="text"
                    className="new-library-input"
                    placeholder="Library name..."
                    value={newLibraryName}
                    onChange={(e) => setNewLibraryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateLibrary();
                      if (e.key === 'Escape') handleCancelCreateLibrary();
                    }}
                    autoFocus
                  />
                  <button className="confirm-btn" onClick={handleCreateLibrary} title="Create">✓</button>
                  <button className="cancel-btn" onClick={handleCancelCreateLibrary} title="Cancel">×</button>
                </div>
              )}
              
              {libraryTree.map(node => renderLibraryNode(node))}
              
            </div>
          </>
        )}
      </div>}

      {showVersionInfo && inspectorField && inspectorSnapshot && (
        <div className="modal-overlay" onClick={closeVersionInspector}>
          <div className="modal-content field-version-inspector" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Field Version Inspector</h2>
              <button className="modal-close" onClick={closeVersionInspector}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Field</label>
                <div className="version-inspector-name">
                  {inspectorSnapshot.icon} {inspectorSnapshot.name}
                </div>
              </div>
              <div className="form-group">
                <label>Version</label>
                <select
                  value={selectedInspectorVersion?.version || inspectorSnapshot.version}
                  onChange={(e) => setInspectorVersion(Number(e.target.value))}
                >
                  {inspectorHistory.map((item) => (
                    <option key={`${inspectorField.id}-v${item.version}`} value={item.version}>
                      v{item.version} · {formatSavedAt(item.savedAt)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="version-inspector-grid">
                <div className="version-inspector-row">
                  <span className="version-inspector-label">Base Type</span>
                  <span className="version-inspector-value">{inspectorSnapshot.baseType}</span>
                </div>
                <div className="version-inspector-row">
                  <span className="version-inspector-label">Default Placeholder</span>
                  <span className="version-inspector-value">
                    {inspectorSnapshot.defaultPlaceholder || '—'}
                  </span>
                </div>
                <div className="version-inspector-row">
                  <span className="version-inspector-label">Description</span>
                  <span className="version-inspector-value">
                    {inspectorSnapshot.description || '—'}
                  </span>
                </div>
                <div className="version-inspector-row">
                  <span className="version-inspector-label">Name IRI</span>
                  <span className="version-inspector-value">
                    {inspectorSnapshot.nameIri || '—'}
                  </span>
                </div>
                <div className="version-inspector-row">
                  <span className="version-inspector-label">Name IRI Label</span>
                  <span className="version-inspector-value">
                    {inspectorSnapshot.nameIriLabel || '—'}
                  </span>
                </div>
                <div className="version-inspector-row">
                  <span className="version-inspector-label">Libraries</span>
                  <span className="version-inspector-value">
                    {inspectorLibraryNames.length > 0 ? inspectorLibraryNames.join(', ') : 'Unassigned'}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Validation Rules</label>
                {inspectorSnapshot.validationRules.length === 0 ? (
                  <span className="input-hint">No validation rules in this version.</span>
                ) : (
                  <ul className="version-rule-list">
                    {inspectorSnapshot.validationRules.map((rule, index) => (
                      <li key={`${rule.type}-${index}`} className="version-rule-item">
                        <span className="version-rule-type">{rule.type}</span>
                        <span className="version-rule-value">{String(rule.value)}</span>
                        <span className="version-rule-message">{rule.message || 'No message'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
