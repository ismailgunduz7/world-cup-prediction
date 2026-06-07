export type ValidationErrors = Record<string, string>;

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function required(value: string | undefined | null, fieldLabel: string): string | undefined {
  if (!value?.trim()) {
    return `${fieldLabel} zorunludur`;
  }
  return undefined;
}

export function minLength(
  value: string | undefined | null,
  min: number,
  fieldLabel: string,
): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length > 0 && trimmed.length < min) {
    return `${fieldLabel} en az ${min} karakter olmalıdır`;
  }
  return undefined;
}

export function optionalMinLength(
  value: string | undefined | null,
  min: number,
  fieldLabel: string,
): string | undefined {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return undefined;
  return minLength(trimmed, min, fieldLabel);
}

export function requiredNumber(
  value: number | null | undefined,
  fieldLabel: string,
): string | undefined {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return `${fieldLabel} zorunludur`;
  }
  return undefined;
}

export function mergeErrors(...groups: Array<Record<string, string | undefined>>): ValidationErrors {
  return groups.reduce<ValidationErrors>((acc, group) => {
    for (const [key, value] of Object.entries(group)) {
      if (value) acc[key] = value;
    }
    return acc;
  }, {});
}

export function pickError(errors: ValidationErrors, field: string): string | undefined {
  return errors[field];
}
