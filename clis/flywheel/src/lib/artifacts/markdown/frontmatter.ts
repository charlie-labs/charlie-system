import type { ArtifactProblem } from '../contract.js';
import { asRecord } from '../values.js';
import { parseYaml } from '../yaml/parse.js';
import type { MarkdownFrontmatter } from './contract.js';

export type ParsedFrontmatter = Readonly<{
  readonly problems: readonly ArtifactProblem[];
  readonly value?: Readonly<Record<string, unknown>>;
}>;

export function parseFrontmatter(
  frontmatter: MarkdownFrontmatter | undefined,
  contents: string,
  path: string
): ParsedFrontmatter {
  if (frontmatter === undefined) {
    return {
      problems: [
        {
          code: 'ARTIFACT_FRONTMATTER_REQUIRED',
          message: 'artifact requires YAML frontmatter',
          source: {
            end: { column: 1, line: 1 },
            path,
            start: { column: 1, line: 1 },
          },
        },
      ],
    };
  }
  const yaml = parseYaml(
    frontmatter.value,
    path,
    frontmatter.valueOffset,
    contents
  );
  const problems = yaml.problems.map((problem) => ({
    code: 'ARTIFACT_FRONTMATTER_INVALID',
    message: `invalid YAML frontmatter: ${problem.message}`,
    source: problem.source,
  }));
  const value = asRecord(yaml.documents[0]?.value);
  if (value === undefined && problems.length === 0) {
    problems.push({
      code: 'ARTIFACT_FRONTMATTER_INVALID',
      message: 'YAML frontmatter must be a mapping',
      source: frontmatter.source,
    });
  }
  return { problems, ...(value === undefined ? {} : { value }) };
}
