import { useState, useMemo } from 'react';
import type { FormSchema, TemplateLibrary } from '../types';

interface TemplateLibraryBrowserProps {
  templates: FormSchema[];
  templateLibraries: TemplateLibrary[];
  activeTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate: (libraryId?: string) => void;
  onCreateLibrary: (name: string, parentId?: string) => void;
  onDeleteTemplate: (templateId: string) => void;
  onDeleteLibrary: (id: string) => void;
}

interface LibraryNode {
  library: TemplateLibrary;
  children: LibraryNode[];
  templates: FormSchema[];
}

export function TemplateLibraryBrowser({
  templates,
  templateLibraries,
  activeTemplateId,
  onSelectTemplate,
  onCreateTemplate,
  onCreateLibrary,
  onDeleteTemplate,
  onDeleteLibrary,
}: TemplateLibraryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLibraries, setExpandedLibraries] = useState<Set<string>>(new Set());
  const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(true);
  const [isCreatingLibrary, setIsCreatingLibrary] = useState<string | null>(null);
  const [newLibraryName, setNewLibraryName] = useState('');

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

  const renderTemplateItem = (template: FormSchema) => {
    const isActive = template.id === activeTemplateId;
    return (
      <div
        key={template.id}
        className={`field-item ${isActive ? 'selected' : ''}`}
        onClick={() => onSelectTemplate(template.id)}
      >
        <span className="field-item-icon">📋</span>
        <span className="field-item-name">{template.title || 'Untitled Template'}</span>
        <span className="field-item-type">{template.fields.length} field{template.fields.length !== 1 ? 's' : ''}</span>
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
      </div>
    );
  };

  const renderLibraryNode = (node: LibraryNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedLibraries.has(node.library.id);
    const hasContent = node.templates.length > 0 || node.children.length > 0 || isCreatingLibrary === node.library.id;

    return (
      <div key={node.library.id} className="library-node">
        <div
          className="library-header"
          onClick={() => toggleLibrary(node.library.id)}
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
    <div className="library-browser">
      <div className="library-browser-header">
        <div className="library-header-row">
          <h3>Template Library</h3>
          <button
            className="new-library-btn"
            onClick={() => handleStartCreateLibrary(null)}
            title="Create new folder"
          >
            + New
          </button>
        </div>
        <div className="library-search">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search templates..."
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
                  className="library-header"
                  onClick={() => setIsUnassignedExpanded(!isUnassignedExpanded)}
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
      </div>
    </div>
  );
}
