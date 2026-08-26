/// <reference types="bun" />

const USAGE =
  'Usage: bun .agents/daemons/pr-review-triage/scripts/bootstrap-data.ts [--repo <owner/repo>] --pr <number>';

const HELP_TEXT = `Bootstrap baseline data for the pr-review-triage daemon.

${USAGE}

Options:
  --repo <owner/repo>   Optional repository identity. Defaults to the current GitHub repository.
  --pr <number>         Required pull request number (positive integer).
  -h, --help            Show this help text.
`;

const GRAPHQL_QUERY = `
query PrReviewTriageBootstrap($owner: String!, $repo: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    nameWithOwner
    pullRequest(number: $prNumber) {
      id
      number
      title
      state
      isDraft
      merged
      url
      baseRefName
      baseRefOid
      headRefName
      headRefOid
      author {
        __typename
        login
      }
      authorAssociation
      reviews(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          state
          submittedAt
          body
          url
          authorAssociation
          author {
            __typename
            login
          }
        }
      }
      reviewThreads(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          viewerCanResolve
          path
          line
          comments(first: 100) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              body
              createdAt
              updatedAt
              url
              authorAssociation
              isMinimized
              minimizedReason
              viewerCanMinimize
              viewerCanReact
              author {
                __typename
                login
              }
              reactionGroups {
                content
                viewerHasReacted
                users(first: 1) {
                  totalCount
                }
              }
            }
          }
        }
      }
      comments(first: 100) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          body
          createdAt
          updatedAt
          url
          authorAssociation
          isMinimized
          minimizedReason
          viewerCanMinimize
          viewerCanReact
          author {
            __typename
            login
          }
          reactionGroups {
            content
            viewerHasReacted
            users(first: 1) {
              totalCount
            }
          }
        }
      }
    }
  }
}
`;

type CliArgs = { repoOwner: string; repoName: string; prNumber: number };

function parseArgs(argv: readonly string[]): CliArgs | null {
  const rawArgs = parseOptionValues(argv);
  if (rawArgs.showHelp) {
    console.log(HELP_TEXT);
    return null;
  }

  const repoRaw = rawArgs.repoRaw ?? inferCurrentRepository();
  const { prRaw } = rawArgs;

  if (prRaw === undefined) {
    throw new TypeError(`--pr is required.\n${USAGE}`);
  }

  const separator = repoRaw.indexOf('/');
  const repoName = repoRaw.slice(separator + 1);
  if (separator <= 0 || repoName.length === 0 || repoName.includes('/')) {
    throw new TypeError(
      `Invalid --repo value: ${repoRaw}. Expected owner/repo.`
    );
  }

  const repoOwner = repoRaw.slice(0, separator);

  const prNumber = parseIntegerString(prRaw, '--pr');
  if (prNumber <= 0) {
    throw new RangeError(
      `Invalid --pr value: ${prRaw}. Expected a positive integer.`
    );
  }

  return { repoOwner, repoName, prNumber };
}

function parseOptionValues(argv: readonly string[]) {
  let repoRaw: string | undefined;
  let prRaw: string | undefined;
  let showHelp = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--repo' || token === '--pr') {
      if (index + 1 >= argv.length) {
        throw new TypeError(`Missing value for ${token}.\n${USAGE}`);
      }

      if (argv[index + 1].startsWith('-')) {
        throw new TypeError(`Missing value for ${token}.\n${USAGE}`);
      }

      if (token === '--repo') {
        repoRaw = argv[index + 1];
      } else {
        prRaw = argv[index + 1];
      }

      index += 1;
      continue;
    }

    if (token === '-h' || token === '--help') {
      showHelp = true;
      continue;
    }

    throw new TypeError(`Unknown argument: ${token}\n${USAGE}`);
  }

  return { repoRaw, prRaw, showHelp };
}

function inferCurrentRepository(): string {
  const result = runGh([
    'repo',
    'view',
    '--json=nameWithOwner',
    '--jq=.nameWithOwner',
  ]);
  assertSuccess(
    'Failed to infer repository with gh repo view',
    result,
    'Failed to infer repository with gh repo view; pass --repo <owner/repo>.'
  );

  const repo = result.stdout.trim();
  if (repo.length === 0) {
    throw new TypeError(
      'Failed to infer repository with gh repo view; pass --repo <owner/repo>.'
    );
  }
  return repo;
}

function parseIntegerString(value: string, flag: string): number {
  if (!/^[0-9]+$/u.test(value)) {
    throw new RangeError(`${flag} must be an integer.`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new RangeError(`${flag} must be an integer.`);
  }

  return parsed;
}

function runGh(args: readonly string[]) {
  const result = Bun.spawnSync({
    cmd: ['gh', ...args],
    stdout: 'pipe',
    stderr: 'pipe',
    maxBuffer: 10 * 1024 * 1024,
  });

  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    success: result.success,
    exitCode: result.exitCode,
  };
}

function assertSuccess(
  prefix: string,
  result: ReturnType<typeof runGh>,
  fallback: string
): void {
  if (result.success) {
    return;
  }

  const stderr = result.stderr.trim();
  if (stderr.length > 0) {
    throw new TypeError(`${prefix}: ${stderr}`);
  }
  throw new TypeError(fallback);
}

function fetchBootstrapData(args: CliArgs): string {
  const result = runGh([
    'api',
    'graphql',
    '-f',
    `query=${GRAPHQL_QUERY}`,
    '-F',
    `owner=${args.repoOwner}`,
    '-F',
    `repo=${args.repoName}`,
    '-F',
    `prNumber=${args.prNumber}`,
  ]);

  assertSuccess(
    'gh api graphql failed',
    result,
    `gh api graphql failed with exit code ${String(result.exitCode)}`
  );

  return result.stdout;
}

function main(): void {
  const args = parseArgs(Bun.argv.slice(2));
  if (args !== null) {
    console.log(fetchBootstrapData(args));
  }
}

main();
