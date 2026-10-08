/**
 * Dependency-free schema validation + coercion.
 *
 * Each field declares a small rule object. `validate()` returns a typed,
 * coerced object or throws a ValidationError aggregating every field problem.
 */
import { ValidationError, type FieldError } from "@/lib/errors";

export type FieldType = "string" | "number" | "boolean" | "date" | "enum";

export interface FieldRule {
  type: FieldType;
  required?: boolean;
  /** Allowed values when type === "enum". */
  values?: readonly string[];
  min?: number; // min length for strings, min value for numbers
  max?: number; // max length for strings, max value for numbers
  pattern?: RegExp;
  /** Default applied when the value is undefined/null/"". */
  default?: unknown;
  /** Trim strings before validating (default true). */
  trim?: boolean;
  /** Custom validator returning an error message, or null when valid. */
  custom?: (value: unknown, all: Record<string, unknown>) => string | null;
}

export type Schema = Record<string, FieldRule>;

type Infer<T extends Schema> = {
  [K in keyof T]: T[K]["type"] extends "number"
    ? number
    : T[K]["type"] extends "boolean"
      ? boolean
      : string;
};

function coerce(
  rule: FieldRule,
  raw: unknown,
): { value: unknown; error: string | null } {
  let value = raw;

  if (value === undefined || value === null || value === "") {
    if (rule.default !== undefined) value = rule.default;
    else if (rule.required) return { value, error: "is required" };
    else return { value: undefined, error: null };
  }

  switch (rule.type) {
    case "string":
    case "enum": {
      if (typeof value !== "string") value = String(value);
      if (rule.trim !== false) value = (value as string).trim();
      const s = value as string;
      if (rule.required && s.length === 0) return { value, error: "is required" };
      if (rule.min !== undefined && s.length < rule.min)
        return { value, error: `must be at least ${rule.min} characters` };
      if (rule.max !== undefined && s.length > rule.max)
        return { value, error: `must be at most ${rule.max} characters` };
      if (rule.pattern && !rule.pattern.test(s))
        return { value, error: "has an invalid format" };
      if (rule.type === "enum" && rule.values && !rule.values.includes(s))
        return { value, error: `must be one of: ${rule.values.join(", ")}` };
      break;
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) return { value, error: "must be a number" };
      if (rule.min !== undefined && n < rule.min)
        return { value, error: `must be ≥ ${rule.min}` };
      if (rule.max !== undefined && n > rule.max)
        return { value, error: `must be ≤ ${rule.max}` };
      value = n;
      break;
    }
    case "boolean": {
      if (typeof value === "boolean") break;
      if (value === "true" || value === "1" || value === 1) value = true;
      else if (value === "false" || value === "0" || value === 0) value = false;
      else return { value, error: "must be a boolean" };
      break;
    }
    case "date": {
      const d = new Date(value as string);
      if (Number.isNaN(d.getTime())) return { value, error: "must be a valid date" };
      value = (value as string).toString();
      break;
    }
  }

  return { value, error: null };
}

export function validate<T extends Schema>(
  schema: T,
  input: unknown,
): Infer<T> {
  const data = (input ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const errors: FieldError[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const { value, error } = coerce(rule, data[field]);
    if (error) {
      errors.push({ field, message: `${field} ${error}` });
      continue;
    }
    if (value !== undefined) {
      if (rule.custom) {
        const msg = rule.custom(value, data);
        if (msg) {
          errors.push({ field, message: msg });
          continue;
        }
      }
      result[field] = value;
    }
  }

  if (errors.length > 0) throw new ValidationError(errors);
  return result as Infer<T>;
}

/** Validate only the subset of fields actually present (for PATCH updates). */
export function validatePartial<T extends Schema>(
  schema: T,
  input: unknown,
): Partial<Infer<T>> {
  const data = (input ?? {}) as Record<string, unknown>;
  const partialSchema: Schema = {};
  for (const [field, rule] of Object.entries(schema)) {
    if (field in data && data[field] !== undefined) {
      partialSchema[field] = { ...rule, required: false };
    }
  }
  return validate(partialSchema as T, data) as Partial<Infer<T>>;
}
