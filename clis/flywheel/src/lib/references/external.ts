import { isSecretBearingUrl } from '../artifacts/authored-reference.js';
import type { ExternalIdentityTarget } from '../targets/contract.js';

export type ExternalReferenceParse =
  | Readonly<{
      readonly kind: 'target';
      readonly target: ExternalIdentityTarget;
    }>
  | Readonly<{ readonly kind: 'not-external' }>
  | Readonly<{ readonly kind: 'invalid' }>
  | Readonly<{ readonly kind: 'unsupported' }>;

const UNSUPPORTED_SCHEME = /^(?:data|file|ftp|git|javascript|mailto|ssh):/iu;
const TASK_REFERENCE = /^\/tasks\/([A-Za-z0-9_-]+)(?:#seq-(\d+))?$/u;

export function parseExternalReference(raw: string): ExternalReferenceParse {
  if (isSecretBearingUrl(raw)) return { kind: 'invalid' };
  if (raw.startsWith('/tasks/')) return parseTaskReference(raw);
  if (/^https?:\/\//iu.test(raw)) return parseHttpReference(raw);
  if (/^https?:/iu.test(raw) || raw.startsWith('//')) {
    return { kind: 'invalid' };
  }
  return UNSUPPORTED_SCHEME.test(raw)
    ? { kind: 'unsupported' }
    : { kind: 'not-external' };
}

function parseTaskReference(raw: string): ExternalReferenceParse {
  const match = TASK_REFERENCE.exec(raw);
  const taskId = match?.[1];
  const sequenceText = match?.[2];
  if (taskId === undefined) return { kind: 'invalid' };
  if (sequenceText === undefined) {
    return { kind: 'target', target: { kind: 'task', taskId } };
  }
  const sequence = Number(sequenceText);
  return Number.isSafeInteger(sequence)
    ? {
        kind: 'target',
        target: { kind: 'transcript-item', sequence, taskId },
      }
    : { kind: 'invalid' };
}

function parseHttpReference(raw: string): ExternalReferenceParse {
  try {
    const url = new URL(raw);
    if (url.username !== '' || url.password !== '') return { kind: 'invalid' };
    const target = providerTarget(url) ?? { kind: 'web', url: url.href };
    return { kind: 'target', target };
  } catch {
    return { kind: 'invalid' };
  }
}

function providerTarget(url: URL): ExternalIdentityTarget | undefined {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'github.com') return githubTarget(url);
  if (hostname === 'linear.app') return linearTarget(url);
  return hostname.endsWith('.slack.com') ? slackTarget(url) : undefined;
}

function githubTarget(url: URL): ExternalIdentityTarget | undefined {
  const segments = decodedSegments(url);
  const owner = segments[0];
  const name = segments[1];
  const route = segments[2];
  const identifier = segments[3];
  if (owner === undefined || name === undefined) return undefined;
  const repository = `${owner}/${name}`.toLowerCase();
  if (route === 'issues' && isNumber(identifier)) {
    return { identifier, kind: 'github', repository, resource: 'issue' };
  }
  if (route === 'pull' && isNumber(identifier)) {
    return {
      identifier,
      kind: 'github',
      repository,
      resource: 'pull-request',
    };
  }
  if (route === 'commit' && isCommit(identifier)) {
    return {
      identifier: identifier.toLowerCase(),
      kind: 'github',
      repository,
      resource: 'commit',
    };
  }
  return route === 'blob'
    ? githubFileTarget(url, repository, segments)
    : undefined;
}

function githubFileTarget(
  url: URL,
  repository: string,
  segments: readonly string[]
): ExternalIdentityTarget | undefined {
  const revision = segments[3];
  const filePath = segments.slice(4).join('/');
  if (revision === undefined || filePath === '') return undefined;
  const selector =
    url.hash === '' ? undefined : decodeURIComponent(url.hash.slice(1));
  return {
    kind: 'source-repository-file',
    path: filePath,
    repository,
    revision,
    ...(selector === undefined ? {} : { selector }),
  };
}

function linearTarget(url: URL): ExternalIdentityTarget | undefined {
  const segments = decodedSegments(url);
  const issueIndex = segments.indexOf('issue');
  const issueId = segments[issueIndex + 1];
  return issueIndex >= 0 && /^[A-Za-z][A-Za-z0-9]*-\d+$/u.test(issueId ?? '')
    ? { issueId: issueId?.toUpperCase() ?? '', kind: 'linear' }
    : undefined;
}

function slackTarget(url: URL): ExternalIdentityTarget | undefined {
  const segments = decodedSegments(url);
  const channelId = segments[1];
  if (
    segments[0] !== 'archives' ||
    channelId === undefined ||
    !/^[A-Z0-9]+$/u.test(channelId)
  ) {
    return undefined;
  }
  const message = segments[2];
  if (message === undefined) return { channelId, kind: 'slack' };
  const digits = /^p(\d{7,})$/u.exec(message)?.[1];
  if (digits === undefined || segments.length !== 3) return undefined;
  const split = digits.length - 6;
  return {
    channelId,
    kind: 'slack',
    messageTs: `${digits.slice(0, split)}.${digits.slice(split)}`,
  };
}

function decodedSegments(url: URL): readonly string[] {
  return url.pathname
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => decodeURIComponent(segment));
}

function isNumber(value: string | undefined): value is string {
  return value !== undefined && /^\d+$/u.test(value);
}

function isCommit(value: string | undefined): value is string {
  return value !== undefined && /^[a-f\d]{7,64}$/iu.test(value);
}
