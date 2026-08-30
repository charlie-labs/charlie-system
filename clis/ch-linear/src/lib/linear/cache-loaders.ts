import {
  type CustomerStatusesQuery,
  type CustomerTiersQuery,
  type GetInitiativesQuery,
  type GetTeamsQuery,
  type GetWorkflowStatesQuery,
} from '../../generated/linear-sdk.js';
import { getOrSet } from '../cache/index.js';
import { getLinearSdk } from './linear-sdk.js';

type WorkflowStateNodes = GetWorkflowStatesQuery['workflowStates']['nodes'];
type TeamNodes = GetTeamsQuery['teams']['nodes'];
type InitiativeNodes = GetInitiativesQuery['initiatives']['nodes'];
type CustomerTierNodes = CustomerTiersQuery['customerTiers']['nodes'];
type CustomerStatusNodes = CustomerStatusesQuery['customerStatuses']['nodes'];

const PAGE_SIZE = 50;

export async function fetchAllConnection<T>(
  fetchPage: (after?: string) => Promise<{
    nodes: T[];
    hasNext: boolean;
    cursor?: string | undefined;
  }>
): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  let lastCursor: string | undefined;

  while (true) {
    const { nodes, hasNext, cursor } = await fetchPage(after);
    out.push(...nodes);
    if (!hasNext) break;
    if (!cursor) {
      // eslint-disable-next-line no-console
      console.warn(
        'fetchAllConnection: hasNextPage is true but endCursor is missing – aborting pagination.'
      );
      break;
    }
    if (lastCursor !== undefined && cursor === lastCursor) {
      // eslint-disable-next-line no-console
      console.warn(
        'fetchAllConnection: endCursor did not advance – aborting pagination.'
      );
      break;
    }
    lastCursor = cursor;
    after = cursor;
  }
  return out;
}

export async function getWorkflowStates(): Promise<WorkflowStateNodes> {
  return getOrSet('workflowStates', async () => {
    const linear = getLinearSdk();
    return fetchAllConnection(async (after) => {
      const { workflowStates } = await linear.GetWorkflowStates({
        first: PAGE_SIZE,
        ...(after !== undefined ? { after } : {}),
      });
      return {
        nodes: workflowStates.nodes,
        hasNext: workflowStates.pageInfo.hasNextPage,
        cursor: workflowStates.pageInfo.endCursor ?? undefined,
      };
    });
  });
}

export async function getTeams(): Promise<TeamNodes> {
  return getOrSet('teams', async () => {
    const linear = getLinearSdk();
    return fetchAllConnection(async (after) => {
      const { teams } = await linear.GetTeams({
        first: PAGE_SIZE,
        ...(after !== undefined ? { after } : {}),
      });
      return {
        nodes: teams.nodes,
        hasNext: teams.pageInfo.hasNextPage,
        cursor: teams.pageInfo.endCursor ?? undefined,
      };
    });
  });
}

export async function getInitiatives(): Promise<InitiativeNodes> {
  return getOrSet('initiatives', async () => {
    const linear = getLinearSdk();
    return fetchAllConnection(async (after) => {
      const { initiatives } = await linear.GetInitiatives({
        first: PAGE_SIZE,
        ...(after !== undefined ? { after } : {}),
      });
      return {
        nodes: initiatives.nodes,
        hasNext: initiatives.pageInfo.hasNextPage,
        cursor: initiatives.pageInfo.endCursor ?? undefined,
      };
    });
  });
}

export async function getCustomerTiers(): Promise<CustomerTierNodes> {
  return getOrSet('customerTiers', async () => {
    const linear = getLinearSdk();
    return fetchAllConnection(async (after) => {
      const { customerTiers } = await linear.CustomerTiers({
        first: PAGE_SIZE,
        ...(after !== undefined ? { after } : {}),
      });
      return {
        nodes: customerTiers.nodes,
        hasNext: customerTiers.pageInfo.hasNextPage,
        cursor: customerTiers.pageInfo.endCursor ?? undefined,
      };
    });
  });
}

export async function getCustomerStatuses(): Promise<CustomerStatusNodes> {
  return getOrSet('customerStatuses', async () => {
    const linear = getLinearSdk();
    return fetchAllConnection(async (after) => {
      const { customerStatuses } = await linear.CustomerStatuses({
        first: PAGE_SIZE,
        ...(after !== undefined ? { after } : {}),
      });
      return {
        nodes: customerStatuses.nodes,
        hasNext: customerStatuses.pageInfo.hasNextPage,
        cursor: customerStatuses.pageInfo.endCursor ?? undefined,
      };
    });
  });
}
