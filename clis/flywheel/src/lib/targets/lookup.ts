import { sortedCopy } from '../repository/ordering.js';
import type { GraphTarget, TargetId } from './contract.js';
import { targetId } from './id.js';

export type TargetAliasRecord = Readonly<{
  readonly aliases: readonly string[];
  readonly target: GraphTarget;
}>;

export type TargetLookupIndex = Readonly<{
  readonly byAlias: ReadonlyMap<string, readonly GraphTarget[]>;
  readonly byId: ReadonlyMap<TargetId, GraphTarget>;
}>;

export type TargetLookup =
  | Readonly<{
      readonly input: string;
      readonly kind: 'found';
      readonly target: GraphTarget;
    }>
  | Readonly<{
      readonly candidates: readonly GraphTarget[];
      readonly input: string;
      readonly kind: 'ambiguous';
    }>
  | Readonly<{
      readonly input: string;
      readonly kind: 'missing';
    }>;

export function buildTargetLookupIndex(
  records: readonly TargetAliasRecord[]
): TargetLookupIndex {
  const byId = new Map<TargetId, GraphTarget>();
  const aliases = new Map<string, Map<TargetId, GraphTarget>>();
  for (const record of records) {
    const id = targetId(record.target);
    if (!byId.has(id)) byId.set(id, record.target);
    for (const alias of new Set([id, ...record.aliases])) {
      const targets = aliases.get(alias) ?? new Map<TargetId, GraphTarget>();
      targets.set(id, record.target);
      aliases.set(alias, targets);
    }
  }
  return {
    byAlias: new Map(
      [...aliases].map(([alias, targets]) => [
        alias,
        sortedCopy([...targets.values()], compareTargets),
      ])
    ),
    byId,
  };
}

export function lookupTarget(
  index: TargetLookupIndex,
  input: string,
  accepts: (target: GraphTarget) => boolean = () => true
): TargetLookup {
  const candidates = (index.byAlias.get(input) ?? []).filter((target) =>
    accepts(target)
  );
  if (candidates.length === 1) {
    const target = candidates[0];
    return target === undefined
      ? { input, kind: 'missing' }
      : { input, kind: 'found', target };
  }
  return candidates.length === 0
    ? { input, kind: 'missing' }
    : { candidates, input, kind: 'ambiguous' };
}

function compareTargets(left: GraphTarget, right: GraphTarget): number {
  return targetId(left).localeCompare(targetId(right));
}
