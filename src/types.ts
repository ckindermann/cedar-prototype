export type FieldType = 'text' | 'email' | 'number' | 'date' | 'textarea' | 'select' | 'checkbox';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  multiple: boolean;
  options?: string[]; // For select fields
}

export interface FormSchema {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}
