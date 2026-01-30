import { useState } from 'react'
import { FormBuilder } from './components/FormBuilder'
import { FieldDesigner } from './components/FieldDesigner'
import type { CustomFieldType, FieldLibrary } from './types'
import './App.css'

function App() {
  const [activeSection, setActiveSection] = useState<'forms' | 'fields'>('forms');
  const [customFields, setCustomFields] = useState<CustomFieldType[]>([]);
  const [fieldLibraries, setFieldLibraries] = useState<FieldLibrary[]>([]);

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
        <FormBuilder customFields={customFields} fieldLibraries={fieldLibraries} />
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
