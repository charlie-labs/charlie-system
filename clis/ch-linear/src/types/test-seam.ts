import { type GetWorkflowStatesQuery } from '../generated/linear-sdk.js';

declare global {
  // Test-only seam (used in unit/command tests). Production code ignores it.
  // eslint-disable-next-line no-var
  var CH_LINEAR_TEST_WORKFLOW_STATES:
    | (() => Promise<GetWorkflowStatesQuery['workflowStates']['nodes']>)
    | undefined;
}

export {};
