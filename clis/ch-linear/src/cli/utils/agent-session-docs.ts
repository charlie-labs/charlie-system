const AGENT_SESSION_JSON_SHAPE_LINES: string[] = [
  'type AgentSession = {',
  '  id: uuid;',
  '  status: string | null;',
  '  type: string | null;',
  '  createdAt: ISODate;',
  '  updatedAt: ISODate;',
  '  issue: { identifier: string | null } | null;',
  '  comment: { id: uuid | null } | null;',
  '  externalUrls: { url: string; label: string | null }[] | null;',
  '  summary: string | null;',
  '  plan: unknown | null;',
  '};',
];

export const AGENT_SESSION_JSON_SHAPE_WRAPPED: string[] = [
  '```ts',
  ...AGENT_SESSION_JSON_SHAPE_LINES,
  '// Output: { agentSession: AgentSession }',
  '```',
];

export const AGENT_SESSION_JSON_SHAPE: string[] = [
  '```ts',
  ...AGENT_SESSION_JSON_SHAPE_LINES,
  '// Output: AgentSession',
  '```',
];
