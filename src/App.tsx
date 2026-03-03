import { useState } from 'react'
import { FormBuilder } from './components/FormBuilder'
import { FieldDesigner } from './components/FieldDesigner'
import type { CustomFieldType, FieldLibrary, FormSchema, TemplateLibrary } from './types'
import './App.css'

const generateId = () => Math.random().toString(36).substring(2, 11);

function App() {
  const [activeSection, setActiveSection] = useState<'forms' | 'fields'>('forms');
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

  const handleDeleteCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
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

  const handleDeleteLibrary = (id: string) => {
    // Remove library and unassign any fields that were in it
    setFieldLibraries(prev => prev.filter(l => l.id !== id));
    setCustomFields(prev => prev.map(f => 
      f.libraryIds?.includes(id) 
        ? { ...f, libraryIds: f.libraryIds.filter(libId => libId !== id) } 
        : f
    ));
  };

  // Template management handlers
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

  const handleDeleteTemplateLibrary = (id: string) => {
    // Remove library and unassign any templates that were in it
    setTemplateLibraries(prev => prev.filter(l => l.id !== id));
    setTemplates(prev => prev.map(t =>
      t.libraryId === id ? { ...t, libraryId: undefined } : t
    ));
  };

  return (
    <div className="app-container">
      <nav className="app-nav">
        <button
          className={`nav-button ${activeSection === 'forms' ? 'active' : ''}`}
          onClick={() => setActiveSection('forms')}
        >
          📋 Template Builder
        </button>
        <button
          className={`nav-button ${activeSection === 'fields' ? 'active' : ''}`}
          onClick={() => setActiveSection('fields')}
        >
          🔧 Field Designer
        </button>
      </nav>

      {activeSection === 'forms' ? (
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
          onSaveTemplateLibrary={handleSaveTemplateLibrary}
          onDeleteTemplateLibrary={handleDeleteTemplateLibrary}
        />
      ) : (
        <FieldDesigner
          customFields={customFields}
          fieldLibraries={fieldLibraries}
          onSaveField={handleSaveCustomField}
          onDeleteField={handleDeleteCustomField}
          onSaveLibrary={handleSaveLibrary}
          onDeleteLibrary={handleDeleteLibrary}
        />
      )}
    </div>
  );
}

export default App
