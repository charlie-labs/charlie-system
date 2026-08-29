const AGENT_ACTIVITY_JSON_SHAPE_LINES: string[] = [
  'type AgentActivity = {',
  '  id: uuid;',
  '  createdAt: ISODate;',
  '  updatedAt: ISODate;',
  '  ephemeral: boolean;',
  "  signal: 'auth' | 'select' | 'stop' | 'continue' | null;",
  '  signalMetadata: Record<string, unknown> | null;',
  '  contextualMetadata: Record<string, unknown> | null;',
  '  content:',
  "    | { type: 'thought' | 'response' | 'error' | 'prompt' | 'elicitation'; body: string }",
  "    | { type: 'action'; action: string; parameter: string; result: string | null };",
  '};',
];

export const AGENT_ACTIVITY_JSON_SHAPE_WRAPPED: string[] = [
  '```ts',
  ...AGENT_ACTIVITY_JSON_SHAPE_LINES,
  '// Output: { agentActivity: AgentActivity }',
  '```',
];

export const AGENT_ACTIVITY_CONNECTION_JSON_SHAPE: string[] = [
  '```ts',
  ...AGENT_ACTIVITY_JSON_SHAPE_LINES,
  'type AgentActivityConnection = {',
  '  nodes: AgentActivity[];',
  '  pageInfo: { hasNextPage: boolean; endCursor: string | null };',
  '};',
  '// Output: AgentActivityConnection',
  '```',
];
