import type { FieldType } from '../types';

interface FieldTypeButtonProps {
  type: FieldType;
  label: string;
  icon: string;
  onAdd: (type: FieldType) => void;
}

export function FieldTypeButton({ type, label, icon, onAdd }: FieldTypeButtonProps) {
  return (
    <button
      className="field-type-button"
      onClick={() => onAdd(type)}
      title={`Add ${label} field`}
    >
      <span className="field-type-icon">{icon}</span>
      <span className="field-type-label">{label}</span>
    </button>
  );
}
