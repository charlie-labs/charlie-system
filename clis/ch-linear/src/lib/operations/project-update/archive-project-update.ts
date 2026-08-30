import {
  type ProjectUpdateArchiveMutation,
  type ProjectUpdateArchiveMutationVariables,
} from '../../../generated/linear-sdk.js';
import { ApiRequestError } from '../../errors/api-request-error.js';
import { NotFoundError } from '../../errors/not-found-error.js';

type ArchiveProjectUpdateParams = { id: string };

type ArchiveProjectUpdateContext = {
  client: {
    ProjectUpdateArchive: (
      vars: ProjectUpdateArchiveMutationVariables
    ) => Promise<ProjectUpdateArchiveMutation>;
  };
};

/** Archive a ProjectUpdate by ID. */
export async function archiveProjectUpdate(
  params: ArchiveProjectUpdateParams,
  ctx: ArchiveProjectUpdateContext
): Promise<NonNullable<ProjectUpdateArchiveMutation['projectUpdateArchive']>> {
  try {
    const resp = await ctx.client.ProjectUpdateArchive({ id: params.id });
    const payload = resp.projectUpdateArchive;
    if (!payload) {
      throw new NotFoundError('project update', params.id);
    }
    if (!payload.success) {
      throw new ApiRequestError('Archive failed: API returned success=false');
    }
    return payload;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new ApiRequestError('Failed to archive project update', err);
  }
}

// No default export – keep public API purely named.
