import {
  referenceRepositoryClassifications,
  referenceRepositoryParsedArtifacts,
} from './reference-repository-classifications.js';
import {
  referenceRepositoryAuthoredReferences,
  referenceRepositoryRelationships,
  referenceRepositoryResolvedReferences,
} from './reference-repository-graph.js';
import { referenceRepositoryRetrieval } from './reference-repository-retrieval.js';
import type { ReferenceRepositoryManifest } from './reference-repository-types.js';

export function referenceRepositoryManifest(): ReferenceRepositoryManifest {
  const { retrieval, representativeSourceUnits, sourceUnitCount } =
    referenceRepositoryRetrieval();
  return {
    authoredReferences: referenceRepositoryAuthoredReferences(),
    classifications: referenceRepositoryClassifications(),
    directories: [
      '.flywheel',
      'core',
      'core/.agents',
      'core/.agents/daemons',
      'core/.agents/daemons/bootstrap',
      'customer-wide',
      'customer-wide/.agents',
      'customer-wide/.agents/daemons',
      'customer-wide/.agents/daemons/release-review',
      'customer-wide/.agents/skills',
      'customer-wide/.agents/skills/release-operator',
      'customer-wide/.agents/skills/release-operator/examples',
      'customer-wide/catalog',
      'customer-wide/docs',
      'customer-wide/docs/assets',
      'repo-specific',
      'repo-specific/acme',
      'repo-specific/acme/api',
      'repo-specific/acme/api/.agents',
      'repo-specific/acme/api/.agents/daemons',
      'repo-specific/acme/api/.agents/daemons/deploy',
      'repo-specific/acme/api/.agents/skills',
      'repo-specific/acme/api/.agents/skills/deploy',
      'repo-specific/acme/api/.agents/skills/deploy/examples',
      'repo-specific/acme/api/catalog',
      'repo-specific/acme/api/docs',
      'repo-specific/acme/api/docs/assets',
      'repo-specific/beta',
      'repo-specific/beta/empty',
      'roles',
    ],
    emptyDirectories: ['repo-specific/beta/empty'],
    parsedArtifacts: referenceRepositoryParsedArtifacts(),
    relationships: referenceRepositoryRelationships(),
    repositories: ['acme/api', 'beta/empty'],
    resolvedReferences: referenceRepositoryResolvedReferences(),
    retrieval,
    representativeSourceUnits,
    sourceUnitCount,
    validation: {
      diagnosticRuleIds: ['FW-REPOSITORY-UNSUPPORTED'],
      status: 'valid',
    },
  };
}
