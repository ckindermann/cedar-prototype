export type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';

export interface ValidationRule {
  type: 'regex' | 'min' | 'max' | 'minLength' | 'maxLength';
  value: string | number;
  message: string;
}

export interface FieldLibrary {
  id: string;
  name: string;
  description?: string;
}

export interface CustomFieldType {
  id: string;
  name: string;
  baseType: FieldType;
  icon: string;
  description?: string;
  validationRules: ValidationRule[];
  defaultPlaceholder?: string;
  libraryIds?: string[]; // Which libraries this field belongs to (empty = unassigned)
}

export interface FormField {
  id: string;
  type: FieldType;
  customFieldTypeId?: string; // Reference to custom field type
  libraryId?: string; // Which library this field was created from (null = standard fields)
  label: string;
  placeholder?: string;
  required: boolean;
  multiple: boolean;
  options?: string[]; // For select fields
  validationRules?: ValidationRule[]; // Inherited from custom field or custom per-field
}

export interface FormSchema {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}
