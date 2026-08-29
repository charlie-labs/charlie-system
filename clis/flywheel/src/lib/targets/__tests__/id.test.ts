import { describe, expect, test } from 'bun:test';

import {
  catalogTarget,
  daemonTarget,
  documentSectionTarget,
  documentTarget,
  roleTarget,
  skillTarget,
  targetAliases,
  targetId,
} from '../id.js';

describe('target IDs', () => {
  test('constructs stable kind-prefixed IDs centrally', () => {
    const document = documentTarget('customer-wide/docs/Deploy Guide.md');

    expect(targetId(document)).toBe(
      'document:customer-wide%2Fdocs%2FDeploy%20Guide.md'
    );
    expect(targetId(documentSectionTarget(document, 'release-checklist'))).toBe(
      'document-section:customer-wide%2Fdocs%2FDeploy%20Guide.md#release-checklist'
    );
    expect(
      targetId(
        catalogTarget({
          entityKind: 'Component',
          name: 'Billing-API',
        })
      )
    ).toBe('catalog:component%3Adefault%2Fbilling-api');
    expect(targetId(roleTarget('release-manager'))).toBe(
      'role:release-manager'
    );
    expect(
      targetId(
        daemonTarget(
          'customer-wide/.agents/daemons/release/DAEMON.md',
          'release'
        )
      )
    ).toBe('daemon:customer-wide%2F.agents%2Fdaemons%2Frelease%2FDAEMON.md');
    expect(
      targetId(
        skillTarget(
          'repo-specific/acme/api/.agents/skills/release/SKILL.md',
          'release'
        )
      )
    ).toBe(
      'skill:repo-specific%2Facme%2Fapi%2F.agents%2Fskills%2Frelease%2FSKILL.md'
    );
  });

  test('constructs canonical and authored aliases without a registry', () => {
    const catalog = catalogTarget({
      entityKind: 'Component',
      name: 'Billing-API',
      namespace: 'Default',
    });

    expect(targetAliases(catalog)).toEqual([
      'catalog:component%3Adefault%2Fbilling-api',
      'component:default/billing-api',
      'component:billing-api',
    ]);
    expect(targetAliases(roleTarget('release-manager'))).toEqual([
      'role:release-manager',
      'release-manager',
    ]);
  });
});
