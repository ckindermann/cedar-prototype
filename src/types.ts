export type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox' | 'template';
export type BuilderProfile = 'basic' | 'semantic' | 'modular';

export interface ValidationRule {
  type: 'regex' | 'min' | 'max' | 'minLength' | 'maxLength';
  value: string | number;
  message: string;
}

export interface FieldLibrary {
  id: string;
  name: string;
  description?: string;
  parentId?: string; // For hierarchical folder structure (null = root level)
}

export interface TemplateLibrary {
  id: string;
  name: string;
  description?: string;
  parentId?: string; // For hierarchical folder structure (null = root level)
}

export interface CustomFieldType {
  id: string;
  name: string;
  nameIri?: string; // Semantic identifier for field name
  baseType: FieldType;
  icon: string;
  version: number;
  description?: string;
  validationRules: ValidationRule[];
  defaultPlaceholder?: string;
  libraryIds?: string[]; // Which libraries this field belongs to (empty = unassigned)
}

export interface FormField {
  id: string;
  type: FieldType;
  customFieldTypeId?: string; // Reference to custom field type
  customFieldVersion?: number; // Exact custom field version used in template
  libraryId?: string; // Which library this field was created from (null = standard fields)
  componentTemplateId?: string; // For template component fields
  componentTemplateVersion?: number; // Exact template version used for component fields
  label: string;
  description?: string; // Optional field description shown in preview tooltip
  nameIri?: string; // Semantic identifier for field label
  placeholder?: string;
  required: boolean;
  multiple: boolean;
  options?: string[]; // For select fields
  validationRules?: ValidationRule[]; // Inherited from custom field or custom per-field
}

export interface FormSchema {
  id: string;
  title: string;
  nameIri?: string; // Semantic identifier for template name
  version: number;
  description?: string;
  fields: FormField[];
  libraryId?: string; // Which template library this template belongs to
}

export interface CustomFieldVersion {
  version: number;
  savedAt: string;
  snapshot: CustomFieldType;
}

export interface TemplateVersion {
  version: number;
  savedAt: string;
  snapshot: FormSchema;
}
