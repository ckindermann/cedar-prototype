import { useState } from 'react'
import { FormBuilder } from './components/FormBuilder'
import type { CustomFieldType, FieldLibrary, FormSchema, TemplateLibrary } from './types'
import './App.css'

const generateId = () => Math.random().toString(36).substring(2, 11);

function App() {
  const [customFields, setCustomFields] = useState<CustomFieldType[]>([]);
  const [fieldLibraries, setFieldLibraries] = useState<FieldLibrary[]>([]);

  // Template management
  const [templates, setTemplates] = useState<FormSchema[]>([
    { id: generateId(), title: 'My Template', description: '', fields: [] },
  ]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(templates[0].id);
  const [templateLibraries, setTemplateLibraries] = useState<TemplateLibrary[]>([]);

  const handleSaveCustomField = (field: CustomFieldType) => {
    setCustomFields(prev => {
      const existingIndex = prev.findIndex(f => f.id === field.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = field;
        return updated;
      }
      return [...prev, field];
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
    setTemplates(prev => prev.map(t => t.id === schema.id ? schema : t));
  };

  const handleCreateTemplate = (libraryId?: string) => {
    const newTemplate: FormSchema = {
      id: generateId(),
      title: 'Untitled Template',
      description: '',
      fields: [],
      libraryId,
    };
    setTemplates(prev => [...prev, newTemplate]);
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
          description: '',
          fields: [],
        };
        setActiveTemplateId(newTemplate.id);
        return [newTemplate];
      }
      return filtered;
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
        fieldLibraries={fieldLibraries}
        onSaveCustomField={handleSaveCustomField}
        onSaveLibrary={handleSaveLibrary}
        templates={templates}
        activeTemplate={activeTemplate}
        templateLibraries={templateLibraries}
        onUpdateTemplate={handleUpdateTemplate}
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
