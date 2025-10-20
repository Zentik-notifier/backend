/**
 * Validates if a string is a valid UUID (v4 format)
 * @param identifier - The string to validate
 * @returns true if the string is a valid UUID, false otherwise
 */
export function isUuid(identifier: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(identifier);
}

