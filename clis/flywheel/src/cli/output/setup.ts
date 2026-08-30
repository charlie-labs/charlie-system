import type { SetupResult } from '../../lib/content/setup/contract.js';

export function renderSetupResult(result: SetupResult): string {
  return [
    formatPaths('copied', result.copied),
    formatPaths('skipped', result.skipped),
    'validation: not performed; run content validate before treating the repository as valid or durable',
  ].join('\n');
}

function formatPaths(label: string, paths: readonly string[]): string {
  return paths.length === 0
    ? `${label}: none`
    : [label + ':', ...paths.map((path) => `- ${path}`)].join('\n');
}
