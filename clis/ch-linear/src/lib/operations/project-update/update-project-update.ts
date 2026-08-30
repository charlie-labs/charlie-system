import {
  type ProjectUpdateUpdateMutation,
  type ProjectUpdateUpdateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type UpdateProjectUpdateParams = {
  id: string;
  input: ProjectUpdateUpdateMutationVariables['input'];
};

type UpdateProjectUpdateContext = {
  client: {
    ProjectUpdateUpdate: (
      vars: ProjectUpdateUpdateMutationVariables
    ) => Promise<ProjectUpdateUpdateMutation>;
  };
};

/** Update a ProjectUpdate by ID. */
export async function updateProjectUpdate(
  params: UpdateProjectUpdateParams,
  ctx: UpdateProjectUpdateContext
): Promise<NonNullable<ProjectUpdateUpdateMutation['projectUpdateUpdate']>> {
  try {
    const resp = await ctx.client.ProjectUpdateUpdate({
      id: params.id,
      input: params.input,
    });
    const payload = resp.projectUpdateUpdate;
    if (!payload) {
      throw new NotFoundError('project update', params.id);
    }
    if (!payload.success || !payload.projectUpdate) {
      throw new ApiRequestError('Project update update failed');
    }
    return payload;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new ApiRequestError('Failed to update project update', err);
  }
}

// No default export – keep public API purely named.
