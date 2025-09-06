import { TransformFnParams } from 'class-transformer';

/**
 * Transform a multipart/form-data field into a boolean, preserving undefined when absent.
 * Accepts common truthy/falsey string variants and handles array-wrapped values from multipart parsers.
 */
export function transformMultipartBoolean({
  obj,
  key,
}: TransformFnParams): boolean | undefined {
  const raw = obj?.[key as keyof typeof obj];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (first === undefined || first === null || first === '') return undefined;
  if (typeof first === 'string') {
    const v = first.toLowerCase().trim();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
  }
  if (typeof first === 'number') return first === 1;
  if (typeof first === 'boolean') return first;
  return Boolean(first);
}
