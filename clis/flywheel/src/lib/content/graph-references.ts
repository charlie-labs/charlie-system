import type { AuthoredReference, ParsedArtifact } from './artifact-types.js';
import { makeDiagnostic } from './diagnostics.js';
import type { ContentDiagnostic } from './errors.js';

type ReferenceContext = Readonly<{
  readonly diagnostics: ContentDiagnostic[];
  readonly nodePaths: ReadonlyMap<string, string>;
  readonly nodes: ReadonlyMap<string, ParsedArtifact>;
  readonly related: Set<string>;
  readonly source: ParsedArtifact;
}>;

export function validateReference(
  reference: AuthoredReference,
  context: ReferenceContext
): void {
  if (reference.kind === 'catalog') {
    validateCatalogReference(reference, context);
    return;
  }
  if (reference.kind === 'internal') {
    validateInternalReference(reference, context);
    return;
  }
  validateExternalReference(reference, context);
}

function validateCatalogReference(
  reference: AuthoredReference,
  context: ReferenceContext
): void {
  if (!isCatalogReference(reference.raw)) {
    context.diagnostics.push(
      makeDiagnostic({
        message: 'Catalog references must use kind:namespace/name syntax',
        path: context.source.artifactPath,
        ruleId: 'FW-REF-001',
        target: reference.raw,
      })
    );
    return;
  }
  const [kind, address] = reference.raw.split(':', 2);
  const normalizedAddress =
    address?.includes('/') === true ? address : `default/${address ?? ''}`;
  const target = `catalog:${kind ?? 'unknown'}:${normalizedAddress}`;
  const targetPath = context.nodePaths.get(target);
  if (targetPath !== undefined) {
    context.related.add(targetPath);
    return;
  }
  context.diagnostics.push(
    makeDiagnostic({
      message: `Catalog reference does not resolve: ${reference.raw}`,
      path: context.source.artifactPath,
      ruleId: 'FW-REF-002',
      target,
    })
  );
}

function validateInternalReference(
  reference: AuthoredReference,
  context: ReferenceContext
): void {
  const target = reference.target;
  if (target === undefined) {
    return;
  }
  const baseTarget = target.split('#', 1)[0] ?? target;
  const targetArtifact = context.nodes.get(baseTarget);
  if (targetArtifact !== undefined) {
    const fragment = fragmentFromTarget(target);
    if (
      fragment !== undefined &&
      targetArtifact.headings?.includes(fragment) !== true
    ) {
      context.diagnostics.push(
        makeDiagnostic({
          message: `internal reference heading does not resolve: ${reference.raw}`,
          path: context.source.artifactPath,
          ruleId: 'FW-REF-002',
          target,
        })
      );
      return;
    }
    const targetPath = context.nodePaths.get(baseTarget);
    if (targetPath !== undefined) {
      context.related.add(targetPath);
    }
    return;
  }
  context.diagnostics.push(
    makeDiagnostic({
      message: `internal reference does not resolve: ${reference.raw}`,
      path: context.source.artifactPath,
      ruleId: 'FW-REF-002',
      target,
    })
  );
}

function validateExternalReference(
  reference: AuthoredReference,
  context: ReferenceContext
): void {
  if (isSupportedExternalReference(reference.raw)) {
    return;
  }
  context.diagnostics.push(
    makeDiagnostic({
      message: 'authored external references must use HTTP or HTTPS URLs',
      path: context.source.artifactPath,
      ruleId: 'FW-REF-001',
      target: reference.raw,
    })
  );
}

function fragmentFromTarget(target: string): string | undefined {
  const separator = target.indexOf('#');
  return separator < 0 ? undefined : target.slice(separator + 1);
}

function isCatalogReference(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]*:(?:[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/u.test(
    value
  );
}

function isSupportedExternalReference(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
