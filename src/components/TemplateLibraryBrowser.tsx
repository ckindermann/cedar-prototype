import { useState, useMemo } from 'react';
import type { FormSchema, TemplateLibrary } from '../types';

interface TemplateLibraryBrowserProps {
  templates: FormSchema[];
  templateLibraries: TemplateLibrary[];
  showVersionInfo?: boolean;
  activeTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate: (libraryId?: string) => void;
  onMoveTemplate: (templateId: string, targetLibraryId?: string) => void;
  onAddTemplateComponent?: (templateId: string) => void;
  canAddTemplateComponent?: (templateId: string) => boolean;
  onCreateLibrary: (name: string, parentId?: string) => void;
  onMoveLibrary: (libraryId: string, targetParentId?: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onDeleteLibrary: (id: string) => void;
  searchQuery: string;
}

interface LibraryNode {
  library: TemplateLibrary;
  children: LibraryNode[];
  templates: FormSchema[];
}

type DraggedTemplateItem =
  | { type: 'template'; id: string }
  | { type: 'library'; id: string };

export function TemplateLibraryBrowser({
  templates,
  templateLibraries,
  showVersionInfo = false,
  activeTemplateId,
  onSelectTemplate,
  onCreateTemplate,
  onMoveTemplate,
  onAddTemplateComponent,
  canAddTemplateComponent,
  onCreateLibrary,
  onMoveLibrary,
  onDeleteTemplate,
  onDeleteLibrary,
  searchQuery,
}: TemplateLibraryBrowserProps) {
  const [expandedLibraries, setExpandedLibraries] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(true);
  const [isCreatingLibrary, setIsCreatingLibrary] = useState<string | null>(null);
  const [newLibraryName, setNewLibraryName] = useState('');
  const [draggedItem, setDraggedItem] = useState<DraggedTemplateItem | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Build hierarchical library structure
  const libraryTree = useMemo(() => {
    const rootLibraries: LibraryNode[] = [];
    const libraryMap = new Map<string, LibraryNode>();

    // First pass: create nodes for all libraries
    templateLibraries.forEach(library => {
      const libraryTemplates = templates
        .filter(t => t.libraryId === library.id)
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      libraryMap.set(library.id, {
        library,
        children: [],
        templates: libraryTemplates,
      });
    });

    // Second pass: build tree structure
    templateLibraries.forEach(library => {
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
  }, [templateLibraries, templates]);

  // Unassigned templates (not in any library)
  const unassignedTemplates = useMemo(() => {
    return templates
      .filter(t => !t.libraryId)
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [templates]);

  // Filter templates based on search query
  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase();
    return templates.filter(t =>
      t.title.toLowerCase().includes(query) ||
      t.description?.toLowerCase().includes(query)
    );
  }, [searchQuery, templates]);

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

  const handleStartCreateLibrary = (parentId: string | null) => {
    setIsCreatingLibrary(parentId || 'root');
    setNewLibraryName('');
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

  const resetDragState = () => {
    setDraggedItem(null);
    setDragOverTarget(null);
  };

  const getParentId = (libraryId: string): string | undefined => {
    return templateLibraries.find(l => l.id === libraryId)?.parentId;
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
    if (draggedItem.type === 'template') return true;
    return isValidLibraryMove(draggedItem.id, targetLibraryId);
  };

  const handleDropOnLibrary = (targetLibraryId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || !canDropOnLibrary(targetLibraryId)) return;

    if (draggedItem.type === 'template') {
      onMoveTemplate(draggedItem.id, targetLibraryId);
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

    if (draggedItem.type === 'template') {
      onMoveTemplate(draggedItem.id, undefined);
    } else if (isValidLibraryMove(draggedItem.id, undefined)) {
      onMoveLibrary(draggedItem.id, undefined);
    }
    resetDragState();
  };

  const handleDropOnUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedItem || draggedItem.type !== 'template') return;
    onMoveTemplate(draggedItem.id, undefined);
    resetDragState();
  };

  const renderTemplateItem = (template: FormSchema) => {
    const isActive = template.id === activeTemplateId;
    const canAddComponent = onAddTemplateComponent
      ? (canAddTemplateComponent ? canAddTemplateComponent(template.id) : true)
      : false;

    return (
      <div
        key={template.id}
        className={`field-item ${isActive ? 'selected' : ''} ${
          draggedItem?.type === 'template' && draggedItem.id === template.id ? 'is-dragging' : ''
        }`}
        onClick={() => onSelectTemplate(template.id)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `template:${template.id}`);
          setDraggedItem({ type: 'template', id: template.id });
        }}
        onDragEnd={resetDragState}
      >
        <span className="field-item-icon">📋</span>
        <span className="field-item-name">{template.title || 'Untitled Template'}</span>
        <span className="field-item-type">
          {showVersionInfo
            ? `v${template.version} · ${template.fields.length} field${template.fields.length !== 1 ? 's' : ''}`
            : `${template.fields.length} field${template.fields.length !== 1 ? 's' : ''}`}
        </span>
        <div className="field-item-actions">
          <button
            className="field-item-edit-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteTemplate(template.id);
            }}
            title="Delete template"
          >
            ×
          </button>
          {onAddTemplateComponent && (
            <button
              className="field-item-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (!canAddComponent) return;
                onAddTemplateComponent(template.id);
              }}
              title={canAddComponent ? 'Add template as component' : 'Template cannot be added here'}
              aria-label="Add template as component"
              disabled={!canAddComponent}
            >
              +
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderLibraryNode = (node: LibraryNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedLibraries.has(node.library.id);
    const hasContent = node.templates.length > 0 || node.children.length > 0 || isCreatingLibrary === node.library.id;
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
          <span className="library-field-count">{node.templates.length}</span>
          <div className="library-header-actions">
            <button
              className="add-field-type-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCreateTemplate(node.library.id);
              }}
              title="Create new template"
            >
              📋
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
            <button
              className="add-sublibrary-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteLibrary(node.library.id);
              }}
              title="Delete library"
            >
              ×
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

            {/* Templates in this library */}
            {node.templates.map(template => renderTemplateItem(template))}

            {node.templates.length === 0 && node.children.length === 0 && isCreatingLibrary !== node.library.id && (
              <div className="no-results" style={{ padding: '16px' }}>
                No templates in this library
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
            title={isCollapsed ? 'Expand template library' : 'Collapse template library'}
          >
            {isCollapsed ? '▶' : '▼'} Template Library
          </h3>
          <div className="library-header-controls">
            <button
              className="new-library-btn"
              onClick={() => handleStartCreateLibrary(null)}
              title="Create new template library"
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
                No templates found
              </div>
            ) : (
              filteredResults.map(template => renderTemplateItem(template))
            )}
          </div>
        ) : (
          // Tree view
          <>
            {/* Unassigned Templates */}
            <div className="tree-section">
              <div className="library-node">
                <div
                  className={`library-header ${dragOverTarget === 'unassigned' ? 'drag-over' : ''}`}
                  onClick={() => setIsUnassignedExpanded(!isUnassignedExpanded)}
                  onDragOver={(e) => {
                    if (draggedItem?.type !== 'template') return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverTarget('unassigned');
                  }}
                  onDragLeave={() => {
                    if (dragOverTarget === 'unassigned') {
                      setDragOverTarget(null);
                    }
                  }}
                  onDrop={handleDropOnUnassigned}
                >
                  <span className="library-toggle">{isUnassignedExpanded ? '▼' : '▶'}</span>
                  <span className="library-icon">📚</span>
                  <span className="library-node-name">Unassigned</span>
                  <span className="library-field-count">{unassignedTemplates.length}</span>
                </div>

                {isUnassignedExpanded && (
                  <div className="library-children">
                    {unassignedTemplates.map(template => renderTemplateItem(template))}
                    {unassignedTemplates.length === 0 && (
                      <div className="no-results" style={{ padding: '16px' }}>
                        No unassigned templates
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Template Libraries */}
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

              {libraryTree.length === 0 && unassignedTemplates.length === 0 && isCreatingLibrary !== 'root' && (
                <div className="empty-libraries-hint">
                  <p>No templates yet</p>
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
      </div>}
    </div>
  );
}
