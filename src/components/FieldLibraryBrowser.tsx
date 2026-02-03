import { useState, useMemo, useEffect } from 'react';
import type { CustomFieldType, FieldLibrary, FieldType } from '../types';
import { FIELD_TYPES } from './FormBuilder';

interface FieldLibraryBrowserProps {
  customFields: CustomFieldType[];
  fieldLibraries: FieldLibrary[];
  onAddField: (type: FieldType, customFieldTypeId?: string, libraryId?: string) => void;
  onCreateLibrary: (name: string, parentId?: string) => void;
  onCreateFieldType: (libraryId: string) => void;
  onEditFieldType?: (fieldType: CustomFieldType) => void;
  highlightedFieldType?: { type: FieldType; customFieldTypeId?: string; libraryId?: string } | null;
}

interface LibraryNode {
  library: FieldLibrary;
  children: LibraryNode[];
  fields: CustomFieldType[];
}

export function FieldLibraryBrowser({
  customFields,
  fieldLibraries,
  onAddField,
  onCreateLibrary,
  onCreateFieldType,
  onEditFieldType,
  highlightedFieldType,
}: FieldLibraryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLibraries, setExpandedLibraries] = useState<Set<string>>(new Set());
  const [selectedField, setSelectedField] = useState<{
    field: CustomFieldType | { type: FieldType; label: string; icon: string };
    libraryId: string | null;
    isStandard: boolean;
  } | null>(null);
  const [isStandardExpanded, setIsStandardExpanded] = useState(true);
  const [isCreatingLibrary, setIsCreatingLibrary] = useState<string | null>(null); // null = not creating, 'root' = root level, libraryId = sub-library
  const [newLibraryName, setNewLibraryName] = useState('');

  // Auto-expand library containing highlighted field
  useEffect(() => {
    if (highlightedFieldType?.libraryId) {
      setExpandedLibraries(prev => new Set([...prev, highlightedFieldType.libraryId!]));
    }
  }, [highlightedFieldType]);

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
      const fields = customFields.filter(cf => cf.libraryIds?.includes(library.id));
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
    FIELD_TYPES.forEach(fieldType => {
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

    return results;
  }, [searchQuery, customFields, fieldLibraries]);

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

  const handleAddSelectedField = () => {
    if (!selectedField) return;

    if (selectedField.isStandard) {
      const standardField = selectedField.field as { type: FieldType; label: string; icon: string };
      onAddField(standardField.type);
    } else {
      const customField = selectedField.field as CustomFieldType;
      onAddField(customField.baseType, customField.id, selectedField.libraryId || undefined);
    }

    setSelectedField(null);
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

  const renderLibraryNode = (node: LibraryNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedLibraries.has(node.library.id);
    const hasContent = node.fields.length > 0 || node.children.length > 0 || isCreatingLibrary === node.library.id;

    return (
      <div key={node.library.id} className="library-node">
        <div
          className="library-header"
          onClick={() => toggleLibrary(node.library.id)}
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
                } ${isHighlighted(field.baseType, field.id, false) ? 'highlighted' : ''}`}
                onClick={() => setSelectedField({
                  field,
                  libraryId: node.library.id,
                  isStandard: false,
                })}
              >
                <span className="field-item-icon">{field.icon}</span>
                <span className="field-item-name">{field.name}</span>
                <span className="field-item-type">{field.baseType}</span>
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
    <div className="library-browser">
      <div className="library-browser-header">
        <div className="library-header-row">
          <h3>Field Library</h3>
          <button
            className="new-library-btn"
            onClick={() => handleStartCreateLibrary(null)}
            title="Create new library"
          >
            + New
          </button>
        </div>
        <div className="library-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="library-tree">
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
                  }`}
                  onClick={() => setSelectedField({
                    field: result.field,
                    libraryId: result.libraryId,
                    isStandard: result.isStandard,
                  })}
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
                  <span className="field-item-type">{result.libraryName}</span>
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
                  <span className="library-field-count">{FIELD_TYPES.length}</span>
                </div>

                {isStandardExpanded && (
                  <div className="library-children">
                    {FIELD_TYPES.map(fieldType => (
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
              
              {libraryTree.length === 0 && isCreatingLibrary !== 'root' && (
                <div className="empty-libraries-hint">
                  <p>No custom libraries yet</p>
                  <button 
                    className="create-first-library-btn"
                    onClick={() => handleStartCreateLibrary(null)}
                  >
                    + Create your first library
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer with Add button */}
      <div className="library-browser-footer">
        <button
          className="add-to-template-btn"
          onClick={handleAddSelectedField}
          disabled={!selectedField}
        >
          {selectedField ? (
            <>
              + Add "{selectedField.isStandard 
                ? (selectedField.field as { label: string }).label
                : (selectedField.field as CustomFieldType).name}"
            </>
          ) : (
            'Select a field to add'
          )}
        </button>
      </div>
    </div>
  );
}
