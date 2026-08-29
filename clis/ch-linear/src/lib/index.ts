export {
  createLinearClient,
  type LinearClient,
} from './client/create-client.js';

// Cache
export { type CacheProvider } from './cache/cache-provider.js';
export { MemoryCacheProvider } from './cache/memory-cache-provider.js';
export { DEFAULT_TTL_MS } from './cache/default-ttl-ms.js';
export { DEFAULT_PAGE_SIZE } from './pagination/default-page-size.js';

// Errors
export {
  ApiRequestError,
  NotFoundError,
  PaginationError,
} from './errors/index.js';

// Operations (pilot)
export { listIssues } from './operations/issue/list-issues.js';
export { getIssue } from './operations/issue/get-issue.js';
export { createIssue } from './operations/issue/create-issue.js';
export { updateIssue } from './operations/issue/update-issue.js';
export { searchIssues } from './operations/issue/search-issues.js';

export { listProjects } from './operations/project/list-projects.js';
export { getProject } from './operations/project/get-project.js';

export { listTeams } from './operations/team/list-teams.js';
export { listWorkflowStates } from './operations/workflow-state/list-workflow-states.js';
export { listLabels } from './operations/label/list-labels.js';
export { listProjectLabels } from './operations/label/list-project-labels.js';
export { listUsers } from './operations/user/list-users.js';

export { createDocument } from './operations/document/create-document.js';
export { updateDocument } from './operations/document/update-document.js';
export { getDocument } from './operations/document/get-document.js';
export { searchDocuments } from './operations/document/search-documents.js';

export { listComments } from './operations/comment/list-comments.js';
export { createComment } from './operations/comment/create-comment.js';
export { updateComment } from './operations/comment/update-comment.js';
export { addCommentReaction } from './operations/comment/add-reaction.js';
export { removeCommentReaction } from './operations/comment/remove-reaction.js';

export { createCustomer } from './operations/customer/create-customer.js';
export { listCustomers } from './operations/customer/list-customers.js';

export { createCustomerNeed } from './operations/customer-need/create-customer-need.js';
export { listCustomerNeeds } from './operations/customer-need/list-customer-needs.js';

export { listInitiatives } from './operations/initiative/list-initiatives.js';
export { getInitiative } from './operations/initiative/get-initiative.js';
export { createInitiative } from './operations/initiative/create-initiative.js';
export { updateInitiative } from './operations/initiative/update-initiative.js';

export { createAgentSession } from './operations/agent-session/create.js';
export { createAgentSessionOnIssue } from './operations/agent-session/create-on-issue.js';
export { createAgentSessionOnComment } from './operations/agent-session/create-on-comment.js';
export { getAgentSession } from './operations/agent-session/get.js';
export { updateAgentSession } from './operations/agent-session/update.js';
export { updateAgentSessionExternalUrl } from './operations/agent-session/update-external-url.js';
export { setAgentSessionPlan } from './operations/agent-session/set-plan.js';

export { createAgentActivity } from './operations/agent-activity/create.js';
export { createAgentActivityPrompt } from './operations/agent-activity/create-prompt.js';
export { listAgentActivities } from './operations/agent-activity/list.js';

export { getWorkspaceOverview } from './operations/workspace/get-workspace-overview.js';

// Pagination helper
export { createEarlyStopCallback } from './pagination/early-stop-callback.js';
export { paginateConnection } from './pagination/paginate-connection.js';
