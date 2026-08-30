import { formatIso } from './format.js';

type AgentActivityContentLike =
  | {
      __typename?: string;
      type?: string | null;
      body?: string | null;
      action?: string | null;
      parameter?: string | null;
      result?: string | null;
    }
  | null
  | undefined;

type AgentActivityLike = {
  id: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  ephemeral?: boolean | null;
  signal?: string | null;
  content?: AgentActivityContentLike;
};

export const AGENT_ACTIVITY_TSV_HEADER: string[] = [
  'id',
  'type',
  'signal',
  'ephemeral',
  'createdAt',
  'updatedAt',
  'snippet',
];

const CONTENT_TYPENAME_TO_ACTIVITY_TYPE: Record<string, string> = {
  AgentActivityThoughtContent: 'thought',
  AgentActivityActionContent: 'action',
  AgentActivityResponseContent: 'response',
  AgentActivityPromptContent: 'prompt',
  AgentActivityErrorContent: 'error',
  AgentActivityElicitationContent: 'elicitation',
};

const KNOWN_ACTIVITY_TYPES = new Set<string>(
  Object.values(CONTENT_TYPENAME_TO_ACTIVITY_TYPE)
);

function normalizeActivityType(args: {
  type: string | null | undefined;
  typename: string | undefined;
}): string {
  const { type, typename } = args;

  if (typeof type === 'string' && KNOWN_ACTIVITY_TYPES.has(type)) {
    return type;
  }

  if (!typename) {
    return '';
  }

  return CONTENT_TYPENAME_TO_ACTIVITY_TYPE[typename] ?? '';
}

const SNIPPET_SEGMENTER =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

/**
 * Return the first non-empty string from the provided values.
 */
function pickFirstString(...vals: (string | null | undefined)[]): string {
  for (const v of vals) {
    if (typeof v !== 'string') {
      continue;
    }

    const t = v.trim();
    if (t.length > 0) {
      return t;
    }
  }
  return '';
}

/**
 * Create a whitespace-normalized snippet from text.
 */
function makeSnippet(text: string, max = 60): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= max) {
    return normalized;
  }

  if (SNIPPET_SEGMENTER) {
    let out = '';
    let count = 0;
    for (const { segment } of SNIPPET_SEGMENTER.segment(normalized)) {
      if (count >= max) {
        break;
      }
      out += segment;
      count += 1;
    }
    return out;
  }

  // Fallback: safe for surrogate pairs, but may split complex grapheme clusters (ZWJ sequences).
  return Array.from(normalized).slice(0, max).join('');
}

/**
 * Convert an agent activity to a TSV row.
 *
 * TSV columns (in order): id, type, signal, ephemeral, createdAt, updatedAt, snippet
 *
 * The `type` column is normalized to the known CLI activity types.
 * Unknown values render as an empty string.
 *
 * @param activity - Activity to format
 * @returns TSV row as string[] matching the column order described above
 */
export function agentActivityToTsv(activity: AgentActivityLike): string[] {
  const content = activity.content;
  const contentType = normalizeActivityType({
    type: content?.type,
    typename: content?.__typename,
  });
  const rawText = pickFirstString(
    content?.body,
    content?.action,
    content?.parameter,
    content?.result
  );
  const snippet = makeSnippet(rawText);
  const ephemeral =
    activity.ephemeral == null ? '' : activity.ephemeral ? 'true' : 'false';
  const createdAt = formatIso(activity.createdAt);
  const updatedAt = formatIso(activity.updatedAt);

  return [
    activity.id,
    contentType,
    activity.signal ?? '',
    ephemeral,
    createdAt,
    updatedAt,
    snippet,
  ];
}
