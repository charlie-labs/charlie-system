import type { SourceLocation } from '../../repository/location.js';

export type ParsedYamlDocument = Readonly<{
  readonly fieldSources: ReadonlyMap<string, SourceLocation>;
  readonly source: SourceLocation;
  readonly value: unknown;
}>;

export type YamlProblem = Readonly<{
  readonly message: string;
  readonly source: SourceLocation;
}>;

export type ParsedYaml = Readonly<{
  readonly documents: readonly ParsedYamlDocument[];
  readonly problems: readonly YamlProblem[];
}>;
