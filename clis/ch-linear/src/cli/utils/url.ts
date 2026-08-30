/**
 * Returns true when the value parses as a http(s):// URL.
 * Leading/trailing whitespace is trimmed; schemes other than http/https return false.
 */
export function isValidExternalUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    if (url.username || url.password) {
      return false;
    }
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
