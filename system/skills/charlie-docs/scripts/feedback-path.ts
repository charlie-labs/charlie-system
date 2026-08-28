import { CliError } from './errors.js';

const URL_SCHEME = /^[a-z][a-z\d+.-]*:\/\//iu;

export function toPagePath(rawValue: string, docsOrigin: string): string {
  const input = URL_SCHEME.test(rawValue)
    ? rawValue
    : `${docsOrigin}/${rawValue.replace(/^[/]+/u, '')}`;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new CliError(`invalid page path or URL '${rawValue}'.`);
  }
  if (url.origin !== docsOrigin || url.protocol !== 'https:') {
    throw new CliError(`page URL must use ${docsOrigin}.`);
  }
  if (url.username || url.password) {
    throw new CliError('page URL must not contain credentials.');
  }
  return url.pathname;
}
