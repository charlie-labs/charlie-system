import type { FlywheelArtifact } from '../../lib/artifacts/contract.js';
import type { DaemonActivation } from '../../lib/artifacts/daemon/contract.js';
import type { InspectableTarget } from '../../lib/targets/contract.js';
import {
  renderDocumentDetails,
  type DocumentInspectionView,
} from './document.js';

export function renderArtifactDetails(
  artifact: FlywheelArtifact,
  target: InspectableTarget,
  documentView?: DocumentInspectionView
): string {
  switch (artifact.kind) {
    case 'document':
      return renderDocumentDetails(artifact, target, documentView);
    case 'catalog':
      return catalogDetails(artifact);
    case 'role':
      return `schema: ${artifact.schemaVersion}\nobjective: ${artifact.objective}`;
    case 'daemon':
      return daemonDetails(artifact);
    case 'skill':
      return skillDetails(artifact);
  }
  return unreachable(artifact);
}

function catalogDetails(
  artifact: Extract<FlywheelArtifact, { readonly kind: 'catalog' }>
): string {
  return [
    `entity: ${artifact.entityKind}:${artifact.namespace}/${artifact.name}`,
    `api version: ${artifact.apiVersion}`,
    `lifecycle: ${artifact.lifecycle.status}`,
    ...(artifact.title === undefined ? [] : [`title: ${artifact.title}`]),
    ...(artifact.description === undefined
      ? []
      : [`description: ${artifact.description}`]),
    '',
    'spec:',
    JSON.stringify(artifact.spec, undefined, 2),
  ].join('\n');
}

function daemonDetails(
  artifact: Extract<FlywheelArtifact, { readonly kind: 'daemon' }>
): string {
  return [
    `id: ${artifact.daemonId}`,
    `schema: ${artifact.schemaVersion}`,
    `purpose: ${artifact.purpose}`,
    ...(artifact.role === undefined ? [] : [`role: ${artifact.role}`]),
    ...activationDetails(artifact.activation),
    'routines:',
    ...artifact.routines.map((routine) => `- ${routine}`),
    ...(artifact.deny.length === 0
      ? []
      : ['deny:', ...artifact.deny.map((item) => `- ${item}`)]),
    '',
    artifact.body.trimEnd(),
  ].join('\n');
}

function activationDetails(activation: DaemonActivation): readonly string[] {
  switch (activation.kind) {
    case 'watch':
      return ['watch:', ...activation.watch.map((item) => `- ${item}`)];
    case 'schedule':
      return [`schedule: ${activation.schedule}`];
    case 'hybrid':
      return [
        `schedule: ${activation.schedule}`,
        'watch:',
        ...activation.watch.map((item) => `- ${item}`),
      ];
  }
  return unreachable(activation);
}

function skillDetails(
  artifact: Extract<FlywheelArtifact, { readonly kind: 'skill' }>
): string {
  return [
    `name: ${artifact.name}`,
    `description: ${artifact.description}`,
    ...(artifact.license === undefined ? [] : [`license: ${artifact.license}`]),
    ...(artifact.compatibility === undefined
      ? []
      : [`compatibility: ${artifact.compatibility}`]),
    ...(artifact.allowedTools === undefined
      ? []
      : [`allowed tools: ${artifact.allowedTools}`]),
    '',
    artifact.body.trimEnd(),
  ].join('\n');
}

function unreachable(value: never): never {
  throw new Error(`unsupported artifact details: ${String(value)}`);
}
