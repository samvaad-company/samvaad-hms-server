import { type ReactNode } from "react";

interface FormRowProps {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
  error?: string;
}

export function FormRow({ label, required, children, hint, error }: FormRowProps) {
  return (
    <div className="flex flex-col gap-[7px]">
      <label className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">
        {label}
        {required && <span className="text-[#ff0004] ml-[3px]">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[11px] font-normal text-[#ff0004] leading-4">{error}</p>
      ) : (
        hint && <p className="text-[11px] font-light text-[color:var(--ink-soft)] leading-4">{hint}</p>
      )}
    </div>
  );
}

export function FormInput({
  placeholder,
  value,
  onChange,
  onBlur,
  type = "text",
  disabled,
  error,
  max,
  min,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  disabled?: boolean;
  error?: boolean;
  max?: string;
  min?: string;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      max={max}
      min={min}
      onChange={(e) => onChange?.(e.target.value)}
      onBlur={onBlur}
      className={`h-[42px] w-full bg-[color:var(--subtle)] border rounded-[8px] px-[14px] text-[14px] font-normal text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-60 focus:outline-none focus:bg-[color:var(--surface)] transition-colors disabled:opacity-50 ${
        error
          ? "border-[#ff0004] focus:border-[#ff0004]"
          : "border-[color:var(--line)] focus:border-[color:var(--brand)]"
      }`}
    />
  );
}

export function FormSelect({
  placeholder,
  options,
  value,
  onChange,
  disabled,
}: {
  placeholder?: string;
  options: { value: string; label: string }[];
  value?: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className="h-[42px] w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-[14px] text-[14px] font-normal text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] transition-colors appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function FormTextarea({
  placeholder,
  value,
  onChange,
  rows = 3,
  disabled,
}: {
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      rows={rows}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-[14px] py-[10px] text-[14px] font-normal text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] placeholder:opacity-60 focus:outline-none focus:border-[color:var(--brand)] focus:bg-[color:var(--surface)] transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}
