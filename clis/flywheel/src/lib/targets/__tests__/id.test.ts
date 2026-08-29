import { describe, expect, test } from 'bun:test';

import {
  catalogTarget,
  daemonTarget,
  documentSectionTarget,
  documentTarget,
  roleTarget,
  skillTarget,
  supportResourceTarget,
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

describe('non-inspectable target IDs', () => {
  test('constructs stable support and external identity IDs', () => {
    expect(
      targetId(supportResourceTarget('customer-wide/docs/assets/diagram.png'))
    ).toBe('support-resource:customer-wide%2Fdocs%2Fassets%2Fdiagram.png');
    expect(
      targetId({
        identifier: '7',
        kind: 'github',
        repository: 'acme/api',
        resource: 'pull-request',
      })
    ).toBe('github:acme%2Fapi:pull-request:7');
    expect(targetId({ issueId: 'BOT-42', kind: 'linear' })).toBe(
      'linear:BOT-42'
    );
    expect(
      targetId({ channelId: 'C123', kind: 'slack', messageTs: '1.000002' })
    ).toBe('slack:C123:1.000002');
    expect(targetId({ kind: 'task', taskId: 'task_1' })).toBe('task:task_1');
    expect(
      targetId({ kind: 'transcript-item', sequence: 8, taskId: 'task_1' })
    ).toBe('transcript-item:task_1:8');
    expect(
      targetId({
        kind: 'source-repository-file',
        path: 'src/index.ts',
        repository: 'acme/api',
        revision: 'main',
        selector: 'L10-L12',
      })
    ).toBe('source-repository-file:acme%2Fapi:main:src%2Findex.ts#L10-L12');
    expect(targetId({ kind: 'web', url: 'https://example.com/' })).toBe(
      'web:https%3A%2F%2Fexample.com%2F'
    );
  });
});
