import { useEffect, useRef, useState } from 'react'
import { FormBuilder } from './components/FormBuilder'
import type {
  BuilderProfile,
  CustomFieldType,
  CustomFieldVersion,
  FieldLibrary,
  FormField,
  FormSchema,
  TemplateLibrary,
  TemplateVersion,
} from './types'
import './App.css'

const generateId = () => Math.random().toString(36).substring(2, 11);
const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const DEFAULT_SELECT_OPTIONS = ['Option 1', 'Option 2', 'Option 3'];
const HISTORY_LIMIT = 200;
type HistoryChangeType = 'text' | 'non-text';

interface AppSnapshot {
  customFields: CustomFieldType[];
  customFieldVersions: Record<string, CustomFieldVersion[]>;
  fieldLibraries: FieldLibrary[];
  templates: FormSchema[];
  templateVersions: Record<string, TemplateVersion[]>;
  activeTemplateId: string;
  templateLibraries: TemplateLibrary[];
}

const stripFieldForTextDiff = (field: FormField): FormField => ({
  ...field,
  label: '',
  description: '',
  placeholder: '',
  nameIri: '',
  nameIriLabel: '',
  options: field.options ? [] : undefined,
});

const stripTemplateForTextDiff = (template: FormSchema): FormSchema => ({
  ...template,
  title: '',
  description: '',
  nameIri: '',
  nameIriLabel: '',
  fields: template.fields.map(stripFieldForTextDiff),
});

const isTemplateTextOnlyChange = (previous: FormSchema, next: FormSchema): boolean => {
  const previousCore = stripTemplateForTextDiff(previous);
  const nextCore = stripTemplateForTextDiff(next);

  if (JSON.stringify(previousCore) !== JSON.stringify(nextCore)) return false;
  return JSON.stringify(previous) !== JSON.stringify(next);
};

const buildLatestTemplateVersionMap = (
  templates: FormSchema[],
  templateVersions: Record<string, TemplateVersion[]>,
  overrides: Record<string, number> = {},
): Record<string, number> => {
  const latestVersions: Record<string, number> = {};

  templates.forEach((template) => {
    latestVersions[template.id] = Math.max(latestVersions[template.id] || 0, template.version);
  });

  Object.entries(templateVersions).forEach(([templateId, history]) => {
    const highestVersion = history.reduce((max, item) => Math.max(max, item.version), 0);
    latestVersions[templateId] = Math.max(latestVersions[templateId] || 0, highestVersion);
  });

  Object.entries(overrides).forEach(([templateId, version]) => {
    latestVersions[templateId] = Math.max(latestVersions[templateId] || 0, version);
  });

  return latestVersions;
};

const syncFieldDependenciesToLatest = (
  field: FormField,
  latestCustomFields: Map<string, CustomFieldType>,
  latestTemplateVersions: Record<string, number>,
): FormField => {
  let nextField = { ...field };

  if (nextField.customFieldTypeId) {
    const latestFieldType = latestCustomFields.get(nextField.customFieldTypeId);
    if (latestFieldType) {
      nextField = {
        ...nextField,
        type: latestFieldType.baseType,
        customFieldVersion: latestFieldType.version,
        validationRules: deepClone(latestFieldType.validationRules),
        options:
          latestFieldType.baseType === 'select'
            ? (nextField.options && nextField.options.length > 0
              ? [...nextField.options]
              : [...DEFAULT_SELECT_OPTIONS])
            : undefined,
        ontologyOptions:
          latestFieldType.baseType === 'ontology-select'
            ? deepClone(latestFieldType.ontologyOptions || nextField.ontologyOptions || [])
            : undefined,
        ontologyOptionSources:
          latestFieldType.baseType === 'ontology-select'
            ? deepClone(latestFieldType.ontologyOptionSources || nextField.ontologyOptionSources || [])
            : undefined,
      };
    }
  }

  if (nextField.type === 'template' && nextField.componentTemplateId) {
    const latestTemplateVersion = latestTemplateVersions[nextField.componentTemplateId];
    if (latestTemplateVersion) {
      nextField = {
        ...nextField,
        componentTemplateVersion: latestTemplateVersion,
      };
    }
  }

  return nextField;
};

const syncTemplatesToLatestDependencies = (
  templatesToSync: FormSchema[],
  latestCustomFieldsList: CustomFieldType[],
  templateVersions: Record<string, TemplateVersion[]>,
  templateVersionOverrides: Record<string, number> = {},
): FormSchema[] => {
  const latestCustomFields = new Map(latestCustomFieldsList.map((field) => [field.id, field]));
  const latestTemplateVersions = buildLatestTemplateVersionMap(
    templatesToSync,
    templateVersions,
    templateVersionOverrides,
  );

  return templatesToSync.map((template) => ({
    ...template,
    fields: template.fields.map((field) =>
      syncFieldDependenciesToLatest(field, latestCustomFields, latestTemplateVersions),
    ),
  }));
};

const hasTemplateChanged = (previousTemplate: FormSchema, nextTemplate: FormSchema): boolean => {
  const previousComparable = { ...previousTemplate, version: 0 };
  const nextComparable = { ...nextTemplate, version: 0 };
  return JSON.stringify(previousComparable) !== JSON.stringify(nextComparable);
};

const versionChangedTemplates = (
  previousTemplates: FormSchema[],
  nextTemplates: FormSchema[],
  templateVersions: Record<string, TemplateVersion[]>,
): {
  versionedTemplates: FormSchema[];
  nextTemplateVersions: Record<string, TemplateVersion[]>;
} => {
  const previousById = new Map(previousTemplates.map((template) => [template.id, template]));
  const nextTemplateVersions: Record<string, TemplateVersion[]> = { ...templateVersions };
  const savedAt = new Date().toISOString();

  const versionedTemplates = nextTemplates.map((nextTemplate) => {
    const previousTemplate = previousById.get(nextTemplate.id);
    if (!previousTemplate) return nextTemplate;

    if (!hasTemplateChanged(previousTemplate, nextTemplate)) {
      return {
        ...nextTemplate,
        version: previousTemplate.version,
      };
    }

    const history = nextTemplateVersions[nextTemplate.id] || [];
    const highestVersion = history.reduce((max, item) => Math.max(max, item.version), 0);
    const nextVersion = highestVersion + 1 || 1;

    const versionedTemplate: FormSchema = {
      ...nextTemplate,
      version: nextVersion,
      fields: deepClone(nextTemplate.fields),
    };

    nextTemplateVersions[nextTemplate.id] = [
      ...history,
      {
        version: nextVersion,
        savedAt,
        snapshot: deepClone(versionedTemplate),
      },
    ];

    return versionedTemplate;
  });

  return {
    versionedTemplates,
    nextTemplateVersions,
  };
};

function App() {
  const [customFields, setCustomFields] = useState<CustomFieldType[]>([]);
  const [customFieldVersions, setCustomFieldVersions] = useState<Record<string, CustomFieldVersion[]>>({});
  const [fieldLibraries, setFieldLibraries] = useState<FieldLibrary[]>([]);

  // Template management
  const [initialTemplate] = useState<FormSchema>(() => ({
    id: generateId(),
    title: 'My Template',
    nameIri: '',
    description: '',
    version: 1,
    fields: [],
  }));
  const [templates, setTemplates] = useState<FormSchema[]>([initialTemplate]);
  const [templateVersions, setTemplateVersions] = useState<Record<string, TemplateVersion[]>>({
    [initialTemplate.id]: [
      {
        version: initialTemplate.version,
        savedAt: new Date().toISOString(),
        snapshot: deepClone(initialTemplate),
      },
    ],
  });
  const [activeTemplateId, setActiveTemplateId] = useState<string>(initialTemplate.id);
  const [templateLibraries, setTemplateLibraries] = useState<TemplateLibrary[]>([]);
  const [undoStack, setUndoStack] = useState<AppSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<AppSnapshot[]>([]);
  const lastHistoryChangeTypeRef = useRef<HistoryChangeType | null>(null);

  const createSnapshot = (): AppSnapshot => ({
    customFields: deepClone(customFields),
    customFieldVersions: deepClone(customFieldVersions),
    fieldLibraries: deepClone(fieldLibraries),
    templates: deepClone(templates),
    templateVersions: deepClone(templateVersions),
    activeTemplateId,
    templateLibraries: deepClone(templateLibraries),
  });

  const applySnapshot = (snapshot: AppSnapshot) => {
    setCustomFields(deepClone(snapshot.customFields));
    setCustomFieldVersions(deepClone(snapshot.customFieldVersions));
    setFieldLibraries(deepClone(snapshot.fieldLibraries));
    setTemplates(deepClone(snapshot.templates));
    setTemplateVersions(deepClone(snapshot.templateVersions));
    setActiveTemplateId(snapshot.activeTemplateId);
    setTemplateLibraries(deepClone(snapshot.templateLibraries));
  };

  const recordHistory = (changeType: HistoryChangeType = 'non-text') => {
    if (changeType === 'text' && lastHistoryChangeTypeRef.current === 'text') {
      return;
    }

    const snapshot = createSnapshot();
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      return next.length > HISTORY_LIMIT
        ? next.slice(next.length - HISTORY_LIMIT)
        : next;
    });
    setRedoStack([]);
    lastHistoryChangeTypeRef.current = changeType;
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousSnapshot = undoStack[undoStack.length - 1];
    const currentSnapshot = createSnapshot();

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => {
      const next = [...prev, currentSnapshot];
      return next.length > HISTORY_LIMIT
        ? next.slice(next.length - HISTORY_LIMIT)
        : next;
    });
    applySnapshot(previousSnapshot);
    lastHistoryChangeTypeRef.current = null;
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot = createSnapshot();

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => {
      const next = [...prev, currentSnapshot];
      return next.length > HISTORY_LIMIT
        ? next.slice(next.length - HISTORY_LIMIT)
        : next;
    });
    applySnapshot(nextSnapshot);
    lastHistoryChangeTypeRef.current = null;
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      const isTypingTarget = !!target?.isContentEditable ||
        targetTag === 'input' ||
        targetTag === 'textarea' ||
        targetTag === 'select';
      if (isTypingTarget) return;

      const key = event.key.toLowerCase();
      const isUndoKey = key === 'z' && !event.shiftKey;
      const isRedoKey = (key === 'z' && event.shiftKey) || key === 'y';

      if (isUndoKey && undoStack.length > 0) {
        event.preventDefault();
        handleUndo();
      }

      if (isRedoKey && redoStack.length > 0) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [undoStack.length, redoStack.length, undoStack, redoStack]);

  const handleSaveCustomField = (field: CustomFieldType, profile: BuilderProfile) => {
    recordHistory();
    const savedAt = new Date().toISOString();
    const currentVersion = customFields.find((f) => f.id === field.id)?.version || 0;
    const nextVersion = currentVersion + 1 || 1;
    const fieldWithVersion: CustomFieldType = {
      ...field,
      version: nextVersion,
      validationRules: deepClone(field.validationRules),
      libraryIds: field.libraryIds ? [...field.libraryIds] : undefined,
    };

    const existingIndex = customFields.findIndex((f) => f.id === fieldWithVersion.id);
    const updatedCustomFields =
      existingIndex >= 0
        ? customFields.map((existingField) =>
          existingField.id === fieldWithVersion.id ? fieldWithVersion : existingField,
        )
        : [...customFields, fieldWithVersion];
    const fieldHistory = customFieldVersions[fieldWithVersion.id] || [];
    const updatedCustomFieldVersions: Record<string, CustomFieldVersion[]> = {
      ...customFieldVersions,
      [fieldWithVersion.id]: [
        ...fieldHistory,
        {
          version: fieldWithVersion.version,
          savedAt,
          snapshot: deepClone(fieldWithVersion),
        },
      ],
    };

    setCustomFields(updatedCustomFields);
    setCustomFieldVersions(updatedCustomFieldVersions);

    if (profile !== 'modular') {
      const syncedTemplates = syncTemplatesToLatestDependencies(
        templates,
        updatedCustomFields,
        templateVersions,
      );
      const { versionedTemplates, nextTemplateVersions } = versionChangedTemplates(
        templates,
        syncedTemplates,
        templateVersions,
      );
      setTemplates(versionedTemplates);
      setTemplateVersions(nextTemplateVersions);
    }
  };

  const handleSaveLibrary = (library: FieldLibrary) => {
    recordHistory();
    setFieldLibraries(prev => {
      const existingIndex = prev.findIndex(l => l.id === library.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = library;
        return updated;
      }
      return [...prev, library];
    });
  };

  const activeTemplate = templates.find(t => t.id === activeTemplateId) || templates[0];

  const handleUpdateTemplate = (schema: FormSchema, profile: BuilderProfile) => {
    const previousTemplate = templates.find((template) => template.id === schema.id);
    const changeType: HistoryChangeType =
      previousTemplate && isTemplateTextOnlyChange(previousTemplate, schema)
        ? 'text'
        : 'non-text';
    recordHistory(changeType);
    if (profile === 'modular') {
      setTemplates((prev) => prev.map((template) =>
        template.id === schema.id
          ? { ...schema, version: template.version }
          : template,
      ));
      return;
    }

    const history = templateVersions[schema.id] || [];
    const highestVersion = history.reduce((max, item) => Math.max(max, item.version), 0);
    const nextVersion = highestVersion + 1 || 1;
    const updatedTemplates = templates.map((template) =>
      template.id === schema.id ? { ...schema } : template,
    );
    const syncedTemplates = syncTemplatesToLatestDependencies(
      updatedTemplates,
      customFields,
      templateVersions,
      { [schema.id]: nextVersion },
    );
    const { versionedTemplates, nextTemplateVersions } = versionChangedTemplates(
      templates,
      syncedTemplates,
      templateVersions,
    );
    setTemplates(versionedTemplates);
    setTemplateVersions(nextTemplateVersions);
  };

  const handleSaveTemplateVersion = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    recordHistory();

    const savedAt = new Date().toISOString();
    const history = templateVersions[templateId] || [];
    const highestVersion = history.reduce((max, item) => Math.max(max, item.version), 0);
    const nextVersion = highestVersion + 1 || 1;

    const versionedTemplate: FormSchema = {
      ...template,
      version: nextVersion,
      fields: deepClone(template.fields),
    };

    setTemplates(prev => prev.map(t => t.id === templateId ? versionedTemplate : t));
    setTemplateVersions(prev => ({
      ...prev,
      [templateId]: [
        ...history,
        {
          version: nextVersion,
          savedAt,
          snapshot: deepClone(versionedTemplate),
        },
      ],
    }));
  };

  const handleLoadTemplateVersion = (templateId: string, version: number) => {
    const history = templateVersions[templateId] || [];
    const versionItem = history.find((item) => item.version === version);
    if (!versionItem) return;
    recordHistory();
    setTemplates(prev => prev.map(t => t.id === templateId ? deepClone(versionItem.snapshot) : t));
  };

  const handleCreateTemplate = (libraryId?: string) => {
    recordHistory();
    const newTemplate: FormSchema = {
      id: generateId(),
      title: 'Untitled Template',
      nameIri: '',
      description: '',
      version: 1,
      fields: [],
      libraryId,
    };
    setTemplates(prev => [...prev, newTemplate]);
    setTemplateVersions(prev => ({
      ...prev,
      [newTemplate.id]: [
        {
          version: 1,
          savedAt: new Date().toISOString(),
          snapshot: deepClone(newTemplate),
        },
      ],
    }));
    setActiveTemplateId(newTemplate.id);
  };

  const handleDeleteTemplate = (id: string) => {
    recordHistory();
    setTemplates(prev => {
      const filtered = prev.filter(t => t.id !== id);
      // If we deleted the active one, switch to another
      if (id === activeTemplateId && filtered.length > 0) {
        setActiveTemplateId(filtered[0].id);
      }
      // Don't allow deleting the last template
      if (filtered.length === 0) {
        const newTemplate: FormSchema = {
          id: generateId(),
          title: 'My Template',
          nameIri: '',
          description: '',
          version: 1,
          fields: [],
        };
        setTemplateVersions(prev => ({
          ...prev,
          [newTemplate.id]: [
            {
              version: 1,
              savedAt: new Date().toISOString(),
              snapshot: deepClone(newTemplate),
            },
          ],
        }));
        setActiveTemplateId(newTemplate.id);
        return [newTemplate];
      }
      return filtered;
    });
    setTemplateVersions(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleMoveTemplate = (templateId: string, targetLibraryId?: string) => {
    recordHistory();
    setTemplates(prev =>
      prev.map(t =>
        t.id === templateId ? { ...t, libraryId: targetLibraryId } : t
      )
    );
  };

  const handleSaveTemplateLibrary = (library: TemplateLibrary) => {
    recordHistory();
    setTemplateLibraries(prev => {
      const existingIndex = prev.findIndex(l => l.id === library.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = library;
        return updated;
      }
      return [...prev, library];
    });
  };

  const handleMoveTemplateLibrary = (libraryId: string, targetParentId?: string) => {
    recordHistory();
    setTemplateLibraries(prev =>
      prev.map(l =>
        l.id === libraryId ? { ...l, parentId: targetParentId } : l
      )
    );
  };

  const handleDeleteTemplateLibrary = (id: string) => {
    recordHistory();
    // Remove library and unassign any templates that were in it
    setTemplateLibraries(prev => prev.filter(l => l.id !== id));
    setTemplates(prev => prev.map(t =>
      t.libraryId === id ? { ...t, libraryId: undefined } : t
    ));
  };

  const handleMoveCustomField = (fieldTypeId: string, targetLibraryId?: string) => {
    recordHistory();
    setCustomFields(prev =>
      prev.map(field =>
        field.id === fieldTypeId
          ? { ...field, libraryIds: targetLibraryId ? [targetLibraryId] : undefined }
          : field
      )
    );
  };

  const handleMoveFieldLibrary = (libraryId: string, targetParentId?: string) => {
    recordHistory();
    setFieldLibraries(prev =>
      prev.map(l =>
        l.id === libraryId ? { ...l, parentId: targetParentId } : l
      )
    );
  };

  return (
    <div className="app-container">
      <FormBuilder 
        customFields={customFields} 
        customFieldVersions={customFieldVersions}
        fieldLibraries={fieldLibraries}
        onSaveCustomField={handleSaveCustomField}
        onSaveLibrary={handleSaveLibrary}
        templates={templates}
        templateVersions={templateVersions}
        activeTemplate={activeTemplate}
        templateLibraries={templateLibraries}
        onUpdateTemplate={handleUpdateTemplate}
        onSaveTemplateVersion={handleSaveTemplateVersion}
        onLoadTemplateVersion={handleLoadTemplateVersion}
        onSelectTemplate={(id) => setActiveTemplateId(id)}
        onCreateTemplate={handleCreateTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onMoveTemplate={handleMoveTemplate}
        onSaveTemplateLibrary={handleSaveTemplateLibrary}
        onMoveTemplateLibrary={handleMoveTemplateLibrary}
        onDeleteTemplateLibrary={handleDeleteTemplateLibrary}
        onMoveCustomField={handleMoveCustomField}
        onMoveFieldLibrary={handleMoveFieldLibrary}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
      />
    </div>
  );
}

export default App
