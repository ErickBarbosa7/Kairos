import { isHex } from "@kairos/design/theme-tenant";
import { Field, Input } from "./ui";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange(v: string): void;
  error?: string;
  optional?: boolean;
}

export function ColorField({ id, label, value, onChange, error, optional }: Props) {
  const valid = isHex(value);
  return (
    <Field label={label} htmlFor={id} error={error}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={`${label} (selector)`}
          value={valid ? value : "#7C3AED"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="size-11 shrink-0 cursor-pointer rounded-sm border border-line bg-surface p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={optional ? "Opcional" : "#7C3AED"}
          maxLength={7}
          spellCheck={false}
          aria-invalid={!!error || (value !== "" && !valid)}
          className="font-mono"
        />
      </div>
    </Field>
  );
}
