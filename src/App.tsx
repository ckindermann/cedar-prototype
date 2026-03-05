import { useState } from 'react'
import { FormBuilder } from './components/FormBuilder'
import type {
  CustomFieldType,
  CustomFieldVersion,
  FieldLibrary,
  FormSchema,
  TemplateLibrary,
  TemplateVersion,
} from './types'
import './App.css'

const generateId = () => Math.random().toString(36).substring(2, 11);
const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

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

  const handleSaveCustomField = (field: CustomFieldType) => {
    const savedAt = new Date().toISOString();
    const currentVersion = customFields.find((f) => f.id === field.id)?.version || 0;
    const nextVersion = currentVersion + 1 || 1;
    const fieldWithVersion: CustomFieldType = {
      ...field,
      version: nextVersion,
      validationRules: deepClone(field.validationRules),
      libraryIds: field.libraryIds ? [...field.libraryIds] : undefined,
    };

    setCustomFields(prev => {
      const existingIndex = prev.findIndex(f => f.id === fieldWithVersion.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = fieldWithVersion;
        return updated;
      }
      return [...prev, fieldWithVersion];
    });

    setCustomFieldVersions(prev => {
      const history = prev[fieldWithVersion.id] || [];
      return {
        ...prev,
        [fieldWithVersion.id]: [
          ...history,
          {
            version: fieldWithVersion.version,
            savedAt,
            snapshot: deepClone(fieldWithVersion),
          },
        ],
      };
    });
  };

  const handleSaveLibrary = (library: FieldLibrary) => {
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

  const handleUpdateTemplate = (schema: FormSchema) => {
    setTemplates(prev => prev.map(t =>
      t.id === schema.id
        ? { ...schema, version: t.version }
        : t
    ));
  };

  const handleSaveTemplateVersion = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

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
    setTemplates(prev => prev.map(t => t.id === templateId ? deepClone(versionItem.snapshot) : t));
  };

  const handleCreateTemplate = (libraryId?: string) => {
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
    setTemplates(prev =>
      prev.map(t =>
        t.id === templateId ? { ...t, libraryId: targetLibraryId } : t
      )
    );
  };

  const handleSaveTemplateLibrary = (library: TemplateLibrary) => {
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
    setTemplateLibraries(prev =>
      prev.map(l =>
        l.id === libraryId ? { ...l, parentId: targetParentId } : l
      )
    );
  };

  const handleDeleteTemplateLibrary = (id: string) => {
    // Remove library and unassign any templates that were in it
    setTemplateLibraries(prev => prev.filter(l => l.id !== id));
    setTemplates(prev => prev.map(t =>
      t.libraryId === id ? { ...t, libraryId: undefined } : t
    ));
  };

  const handleMoveCustomField = (fieldTypeId: string, targetLibraryId?: string) => {
    setCustomFields(prev =>
      prev.map(field =>
        field.id === fieldTypeId
          ? { ...field, libraryIds: targetLibraryId ? [targetLibraryId] : undefined }
          : field
      )
    );
  };

  const handleMoveFieldLibrary = (libraryId: string, targetParentId?: string) => {
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
      />
    </div>
  );
}

export default App
