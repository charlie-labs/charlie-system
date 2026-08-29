import { formatIso } from './format.js';

type AgentSessionLike = {
  id: string;
  status?: string | null;
  type?: string | null;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  issue?: { identifier?: string | null } | null;
  comment?: { id?: string | null } | null;
};

export const AGENT_SESSION_TSV_HEADER: string[] = [
  'id',
  'status',
  'type',
  'issueIdentifier',
  'commentId',
  'createdAt',
  'updatedAt',
];

/**
 * Convert an agent session to a TSV row.
 *
 * TSV columns (in order): id, status, type, issueIdentifier, commentId, createdAt, updatedAt
 *
 * @param session - Session to format
 * @returns TSV row as string[] matching the column order described above
 */
export function agentSessionToTsv(session: AgentSessionLike): string[] {
  const issueIdentifier = session.issue?.identifier ?? '';
  const commentId = session.comment?.id ?? '';
  const createdAt = formatIso(session.createdAt);
  const updatedAt = formatIso(session.updatedAt);

  return [
    session.id,
    session.status ?? '',
    session.type ?? '',
    issueIdentifier,
    commentId,
    createdAt,
    updatedAt,
  ];
}
