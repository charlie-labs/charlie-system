import { DOCS_ORIGIN } from './config.js';
import { DocsInvocationError } from './errors.js';

const URL_SCHEME = /^[a-z][a-z\d+.-]*:\/\//iu;

export function toPageUrl(rawValue: string): string {
  const input = URL_SCHEME.test(rawValue)
    ? rawValue
    : `${DOCS_ORIGIN}/${rawValue.replace(/^[/]+/u, '')}`;
  const url = parseUrl(rawValue, input);
  assertPageUrl(url);
  return url.href;
}

export function toFeedbackPagePath(rawValue: string): string {
  const input = URL_SCHEME.test(rawValue)
    ? rawValue
    : `${DOCS_ORIGIN}/${rawValue.replace(/^[/]+/u, '')}`;
  const url = parseUrl(rawValue, input);
  if (url.origin !== DOCS_ORIGIN || url.protocol !== 'https:') {
    throw new DocsInvocationError(`page URL must use ${DOCS_ORIGIN}.`);
  }
  if (url.username || url.password) {
    throw new DocsInvocationError('page URL must not contain credentials.');
  }
  return url.pathname;
}

function parseUrl(rawValue: string, input: string): URL {
  try {
    return new URL(input);
  } catch {
    throw new DocsInvocationError(`invalid page path or URL '${rawValue}'.`);
  }
}

function assertPageUrl(url: URL): void {
  if (url.origin !== DOCS_ORIGIN || url.protocol !== 'https:') {
    throw new DocsInvocationError(`page URL must use ${DOCS_ORIGIN}.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new DocsInvocationError(
      'page URL must not contain credentials, query, or fragment.'
    );
  }
}
