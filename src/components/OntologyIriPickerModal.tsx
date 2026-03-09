import { useEffect, useMemo, useRef, useState } from 'react';

interface OntologyClassNode {
  iri: string;
  label: string;
  hasChildren: boolean;
  childrenKey?: string;
  children?: OntologyClassNode[];
}

interface OntologyEntry {
  id: string;
  name: string;
  roots: OntologyClassNode[];
}

interface OntologyIndexPayload {
  ontologies: OntologyEntry[];
}

interface OntologyIriPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIri: (selection: {
    iri: string;
    label: string;
    hasChildren?: boolean;
    childrenKey?: string;
    ontologyId?: string;
  }) => void;
}

const ROOT_KEY = '__root__';
const basePath = import.meta.env.BASE_URL || '/';
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

type FetchResult<T> =
  | { kind: 'success'; data: T }
  | { kind: 'not_found'; attemptedUrls: string[] }
  | { kind: 'error'; attemptedUrls: string[]; message: string };

const fetchJsonWithFallback = async <T,>(
  path: string,
  signal?: AbortSignal,
): Promise<FetchResult<T>> => {
  const urls = toAssetUrls(path);
  const attemptedUrls: string[] = [];
  let hasNon404Failure = false;
  let lastErrorMessage = '';

  for (const url of urls) {
    attemptedUrls.push(url);
    try {
      const response = await fetch(url, { cache: 'no-cache', signal });
      if (response.status === 404) {
        continue;
      }
      if (!response.ok) {
        hasNon404Failure = true;
        lastErrorMessage = `Failed to load ${path} (${response.status})`;
        continue;
      }
      return { kind: 'success', data: (await response.json()) as T };
    } catch (error) {
      hasNon404Failure = true;
      lastErrorMessage = error instanceof Error
        ? error.message
        : `Failed to load ${path}.`;
    }
  }

  if (!hasNon404Failure) {
    return { kind: 'not_found', attemptedUrls };
  }

  return {
    kind: 'error',
    attemptedUrls,
    message: lastErrorMessage || `Failed to load ${path}.`,
  };
};

const toSha1Hex = async (input: string): Promise<string | null> => {
  if (!globalThis.crypto?.subtle) return null;
  const encoded = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-1', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const normalizeNode = (node: unknown): OntologyClassNode | null => {
  if (!node || typeof node !== 'object') return null;
  const raw = node as Record<string, unknown>;
  const iri = typeof raw.iri === 'string' ? raw.iri : '';
  if (!iri) return null;

  const nestedChildren = Array.isArray(raw.children)
    ? raw.children.map((child) => normalizeNode(child)).filter((child): child is OntologyClassNode => child !== null)
    : undefined;

  const hasChildren = typeof raw.hasChildren === 'boolean'
    ? raw.hasChildren
    : Boolean(nestedChildren && nestedChildren.length > 0);

  return {
    iri,
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label : iri,
    hasChildren,
    childrenKey: typeof raw.childrenKey === 'string' ? raw.childrenKey : undefined,
    children: nestedChildren,
  };
};

const normalizePayload = (payload: unknown): OntologyIndexPayload => {
  if (!payload || typeof payload !== 'object') {
    return { ontologies: [] };
  }
  const rawPayload = payload as Record<string, unknown>;
  const rawOntologies = Array.isArray(rawPayload.ontologies) ? rawPayload.ontologies : [];

  const ontologies = rawOntologies
    .map((ontology) => {
      if (!ontology || typeof ontology !== 'object') return null;
      const rawOntology = ontology as Record<string, unknown>;
      const id = typeof rawOntology.id === 'string' ? rawOntology.id : '';
      if (!id) return null;

      const rootsSource = Array.isArray(rawOntology.roots)
        ? rawOntology.roots
        : Array.isArray(rawOntology.classes)
          ? rawOntology.classes
          : [];

      const roots = rootsSource
        .map((node) => normalizeNode(node))
        .filter((node): node is OntologyClassNode => node !== null);

      return {
        id,
        name: typeof rawOntology.name === 'string' && rawOntology.name.trim()
          ? rawOntology.name
          : id,
        roots,
      };
    })
    .filter((ontology): ontology is OntologyEntry => ontology !== null);

  return { ontologies };
};

export function OntologyIriPickerModal({
  isOpen,
  onClose,
  onSelectIri,
}: OntologyIriPickerModalProps) {
  const loadRequestIdRef = useRef(0);
  const [indexData, setIndexData] = useState<OntologyIndexPayload | null>(null);
  const [selectedOntologyId, setSelectedOntologyId] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [childrenByParent, setChildrenByParent] = useState<Record<string, OntologyClassNode[]>>({});
  const [loadedParents, setLoadedParents] = useState<Set<string>>(new Set());
  const [loadingParents, setLoadingParents] = useState<Set<string>>(new Set());
  const [parentErrors, setParentErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen || indexData) return;

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    const controller = new AbortController();

    setIsLoading(true);
    setLoadError(null);

    void (async () => {
      let indexResult = await fetchJsonWithFallback<OntologyIndexPayload>(
        'ontology-roots.json',
        controller.signal,
      );

      if (controller.signal.aborted || requestId !== loadRequestIdRef.current) {
        return;
      }

      if (indexResult.kind === 'not_found') {
        indexResult = await fetchJsonWithFallback<OntologyIndexPayload>(
          'ontology-index.json',
          controller.signal,
        );
        if (controller.signal.aborted || requestId !== loadRequestIdRef.current) {
          return;
        }
      }

      if (indexResult.kind === 'success') {
        const payload = normalizePayload(indexResult.data);
        setIndexData(payload);
        if (payload.ontologies.length > 0) {
          setSelectedOntologyId(payload.ontologies[0].id);
        }
      } else {
        const attempts = Array.from(new Set(indexResult.attemptedUrls)).join(', ');
        const message = indexResult.kind === 'error'
          ? indexResult.message
          : 'Failed to load ontology data.';
        setLoadError(`${message} Tried: ${attempts}`);
      }
    })()
      .finally(() => {
        if (controller.signal.aborted || requestId !== loadRequestIdRef.current) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [isOpen, indexData]);

  useEffect(() => {
    if (!isOpen) {
      setExpandedNodes(new Set());
      setLoadingParents(new Set());
      setIsLoading(false);
      setSearchTerm('');
    }
  }, [isOpen]);

  const activeOntology = useMemo(() => {
    if (!indexData || indexData.ontologies.length === 0) return null;
    return (
      indexData.ontologies.find((ontology) => ontology.id === selectedOntologyId) ||
      indexData.ontologies[0]
    );
  }, [indexData, selectedOntologyId]);

  useEffect(() => {
    if (!activeOntology) return;
    setChildrenByParent({ [ROOT_KEY]: activeOntology.roots });
    setLoadedParents(new Set([ROOT_KEY]));
    setLoadingParents(new Set());
    setParentErrors({});
    setExpandedNodes(new Set());
  }, [activeOntology]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const searchableNodes = useMemo(() => {
    const byIri = new Map<string, OntologyClassNode>();
    Object.values(childrenByParent).forEach((nodes) => {
      nodes.forEach((node) => {
        if (!byIri.has(node.iri)) {
          byIri.set(node.iri, node);
        }
      });
    });
    return Array.from(byIri.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [childrenByParent]);

  const searchResults = useMemo(() => {
    if (!normalizedSearchTerm) return [];
    return searchableNodes.filter((node) =>
      node.label.toLowerCase().includes(normalizedSearchTerm) ||
      node.iri.toLowerCase().includes(normalizedSearchTerm),
    );
  }, [normalizedSearchTerm, searchableNodes]);

  const loadChildren = async (parentNode: OntologyClassNode) => {
    if (!activeOntology) return;
    const parentIri = parentNode.iri;
    if (loadedParents.has(parentIri) || loadingParents.has(parentIri)) return;

    setLoadingParents((previous) => new Set([...previous, parentIri]));
    setParentErrors((previous) => {
      const next = { ...previous };
      delete next[parentIri];
      return next;
    });

    try {
      const inlineChildren = parentNode.children;
      if (Array.isArray(inlineChildren) && inlineChildren.length > 0) {
        setChildrenByParent((previous) => ({ ...previous, [parentIri]: inlineChildren }));
        setLoadedParents((previous) => new Set([...previous, parentIri]));
        return;
      }

      const childKeys = new Set<string>();
      if (parentNode.childrenKey && parentNode.childrenKey.trim()) {
        childKeys.add(parentNode.childrenKey);
      }
      const sha1Key = await toSha1Hex(parentIri);
      if (sha1Key) {
        childKeys.add(sha1Key);
      }

      const ontologyIds = Array.from(new Set([
        activeOntology.id,
        activeOntology.id.toLowerCase(),
        activeOntology.id.toUpperCase(),
      ])).filter((value) => value.trim().length > 0);

      let loadedChildren: OntologyClassNode[] | null = null;
      let failureMessage = '';
      let attemptedUrls: string[] = [];

      for (const ontologyId of ontologyIds) {
        for (const childKey of childKeys) {
          const result = await fetchJsonWithFallback<{ children?: unknown[] }>(
            `ontology-children/${ontologyId}/${childKey}.json`,
          );

          if (result.kind === 'success') {
            const children = Array.isArray(result.data.children)
              ? result.data.children
                .map((child) => normalizeNode(child))
                .filter((child): child is OntologyClassNode => child !== null)
              : [];
            loadedChildren = children;
            break;
          }

          attemptedUrls = [...attemptedUrls, ...result.attemptedUrls];
          if (result.kind === 'error') {
            failureMessage = result.message;
          }
        }
        if (loadedChildren) break;
      }

      if (!loadedChildren) {
        throw new Error(
          failureMessage || `Failed to load child classes. Tried: ${Array.from(new Set(attemptedUrls)).join(', ')}`,
        );
      }

      setChildrenByParent((previous) => ({ ...previous, [parentIri]: loadedChildren }));
      setLoadedParents((previous) => new Set([...previous, parentIri]));
    } catch (error) {
      setParentErrors((previous) => ({
        ...previous,
        [parentIri]: error instanceof Error ? error.message : 'Failed to load child classes.',
      }));
    } finally {
      setLoadingParents((previous) => {
        const next = new Set(previous);
        next.delete(parentIri);
        return next;
      });
    }
  };

  const toggleNode = (node: OntologyClassNode) => {
    if (!node.hasChildren) return;

    setExpandedNodes((previous) => {
      const next = new Set(previous);
      if (next.has(node.iri)) {
        next.delete(node.iri);
      } else {
        next.add(node.iri);
      }
      return next;
    });

    if (!expandedNodes.has(node.iri)) {
      void loadChildren(node);
    }
  };

  const handleSelectClass = (classNode: OntologyClassNode) => {
    onSelectIri({
      iri: classNode.iri,
      label: classNode.label,
      hasChildren: classNode.hasChildren,
      childrenKey: classNode.childrenKey,
      ontologyId: activeOntology?.id,
    });
    onClose();
  };

  const renderTreeNode = (
    classNode: OntologyClassNode,
    depth: number,
    ancestry: Set<string>,
  ): React.ReactNode => {
    const children = childrenByParent[classNode.iri] || [];
    const hasChildren = classNode.hasChildren;
    const isExpanded = expandedNodes.has(classNode.iri);
    const isLoadingChildren = loadingParents.has(classNode.iri);
    const childrenError = parentErrors[classNode.iri];
    const nextAncestry = new Set([...ancestry, classNode.iri]);
    const visibleChildren = children.filter((childNode) => !nextAncestry.has(childNode.iri));

    return (
      <div key={classNode.iri}>
        <div className="ontology-tree-row" style={{ paddingLeft: `${depth * 16}px` }}>
          <button
            type="button"
            className="ontology-tree-toggle"
            onClick={() => toggleNode(classNode)}
            disabled={!hasChildren}
            aria-label={hasChildren ? (isExpanded ? 'Collapse class' : 'Expand class') : 'No child classes'}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
          </button>
          <button
            type="button"
            className="ontology-tree-label"
            onClick={() => {
              if (classNode.hasChildren) {
                toggleNode(classNode);
                return;
              }
              handleSelectClass(classNode);
            }}
            title={classNode.iri}
          >
            {classNode.label}
          </button>
          <button
            type="button"
            className="ontology-tree-select"
            onClick={() => handleSelectClass(classNode)}
            title={`Use ${classNode.label}`}
          >
            Use
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="ontology-tree-children">
            {isLoadingChildren && (
              <div className="ontology-tree-status-row" style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
                Loading child classes...
              </div>
            )}
            {!isLoadingChildren && childrenError && (
              <div className="ontology-tree-status-row" style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
                {childrenError}
                <button
                  type="button"
                  className="ontology-tree-retry"
                  onClick={() => void loadChildren(classNode)}
                >
                  Retry
                </button>
              </div>
            )}
            {!isLoadingChildren && !childrenError && visibleChildren.map((childNode) =>
              renderTreeNode(childNode, depth + 1, nextAncestry),
            )}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  const rootNodes = childrenByParent[ROOT_KEY] || [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ontology-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Select IRI from Ontology</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {isLoading && (
            <div className="ontology-status">Loading ontology classes...</div>
          )}
          {!isLoading && loadError && (
            <div className="ontology-status ontology-status-error">{loadError}</div>
          )}
          {!isLoading && !loadError && indexData && (
            <>
              <div className="form-group">
                <label>Ontology</label>
                <select
                  value={activeOntology?.id || ''}
                  onChange={(e) => {
                    setSelectedOntologyId(e.target.value);
                    setExpandedNodes(new Set());
                    setSearchTerm('');
                  }}
                >
                  {indexData.ontologies.map((ontology) => (
                    <option key={ontology.id} value={ontology.id}>
                      {ontology.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Search Classes</label>
                <input
                  type="text"
                  className="ontology-search-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by label or IRI..."
                />
              </div>
              {normalizedSearchTerm ? (
                <div className="ontology-search-results">
                  {searchResults.length === 0 ? (
                    <div className="ontology-status">No classes match your search.</div>
                  ) : (
                    searchResults.map((node) => (
                      <div key={node.iri} className="ontology-search-row">
                        <button
                          type="button"
                          className="ontology-tree-label"
                          onClick={() => handleSelectClass(node)}
                          title={node.iri}
                        >
                          {node.label}
                        </button>
                        <span className="ontology-search-iri">{node.iri}</span>
                        <button
                          type="button"
                          className="ontology-tree-select"
                          onClick={() => handleSelectClass(node)}
                          title={`Use ${node.label}`}
                        >
                          Use
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="ontology-tree">
                  {rootNodes.length === 0 ? (
                    <div className="ontology-status">No ontology classes found.</div>
                  ) : (
                    rootNodes.map((rootNode) => renderTreeNode(rootNode, 0, new Set()))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
