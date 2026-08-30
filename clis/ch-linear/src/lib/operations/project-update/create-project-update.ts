import {
  type ProjectUpdateCreateMutation,
  type ProjectUpdateCreateMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';

type CreateProjectUpdateParams = {
  input: ProjectUpdateCreateMutationVariables['input'];
};

type CreateProjectUpdateContext = {
  client: {
    ProjectUpdateCreate: (
      vars: ProjectUpdateCreateMutationVariables
    ) => Promise<ProjectUpdateCreateMutation>;
  };
};

/** Create a new ProjectUpdate. */
export async function createProjectUpdate(
  params: CreateProjectUpdateParams,
  ctx: CreateProjectUpdateContext
): Promise<NonNullable<ProjectUpdateCreateMutation['projectUpdateCreate']>> {
  try {
    const resp = await ctx.client.ProjectUpdateCreate({ input: params.input });
    const payload = resp.projectUpdateCreate;
    if (!payload) {
      throw new ApiRequestError('Project update create returned no payload');
    }
    if (!payload.success || !payload.projectUpdate) {
      throw new ApiRequestError('Project update creation failed');
    }
    return payload;
  } catch (err) {
    throw new ApiRequestError('Failed to create project update', err);
  }
}

// No default export – keep public API purely named.
