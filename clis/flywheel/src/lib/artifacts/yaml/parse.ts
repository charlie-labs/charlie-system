import { parseAllDocuments } from 'yaml';

import { createSourceLocator } from '../../repository/location.js';
import type { ParsedYaml, YamlProblem } from './contract.js';

export function parseYaml(
  contents: string,
  path: string,
  offset = 0,
  sourceContents = contents
): ParsedYaml {
  const locator = createSourceLocator(path, sourceContents);
  const parsed = parseAllDocuments(contents, {
    prettyErrors: false,
    uniqueKeys: true,
  });
  const problems: YamlProblem[] = [];
  const documents = parsed.flatMap((document) => {
    problems.push(
      ...document.errors.map((error) => ({
        message: error.message,
        source: locator.atOffsets(offset + error.pos[0], offset + error.pos[1]),
      }))
    );
    if (document.errors.length > 0) {
      return [];
    }
    const start = document.range[0];
    const end = document.range[2];
    const value: unknown = document.toJS();
    return [
      {
        source: locator.atOffsets(offset + start, offset + end),
        value,
      },
    ];
  });
  return { documents, problems };
}
