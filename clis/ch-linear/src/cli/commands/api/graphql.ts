import {
  BaseCommand,
  type CfgFlags,
  defineFlags,
  type ExecCtxOf,
} from '@charlie-labs/oclif-plugin-helpers-zod3';
import { Flags } from '@oclif/core';
import { GraphQLClient } from 'graphql-request';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod3';

import { resolveLinearAuthHeaderValue } from '../../../lib/linear/env.js';

type GraphqlPage = Record<string, unknown>;
type GraphqlResult = GraphqlPage | GraphqlPage[];
type GraphqlExecutor = (
  query: string,
  variables?: Record<string, unknown>
) => Promise<GraphqlPage>;

// ---------------------------------------------------------------------------
//  TEST SUPPORT TYPE DECLARATION
// ---------------------------------------------------------------------------
declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/naming-convention
  var __CH_LINEAR_TEST_RAW_GQL__: GraphqlExecutor | undefined;
}

const manifest = defineFlags({
  query: {
    oclif: Flags.string({
      char: 'q',
      description: 'GraphQL query string or @file.graphql',
      required: true,
    }),
    schema: z.string().min(1, 'query is required'),
  },
  var: {
    oclif: Flags.string({
      char: 'v',
      description: 'GraphQL variable (key=value). Repeat for multiple.',
      multiple: true,
    }),
    schema: z.array(z.string()).default([]),
  },
  paginate: {
    oclif: Flags.boolean({
      description:
        'Follow `pageInfo { hasNextPage endCursor }` automatically (assumes `after` variable)',
      default: false,
    }),
    schema: z.boolean().default(false),
  },
  pretty: {
    oclif: Flags.boolean({
      description: 'Pretty-print JSON output',
      required: false,
    }),
    schema: z.boolean().optional(),
  },
} as const);

export default class ApiGraphql extends BaseCommand<CfgFlags<typeof manifest>> {
  static override get manifest() {
    return manifest;
  }
  static override get flags() {
    const basePrototype = Object.getPrototypeOf(this);
    const maybeRegister = Reflect.get(basePrototype, 'registerManifest');
    if (typeof maybeRegister === 'function') {
      return maybeRegister.call(this, this.manifest);
    }
    return this.manifest.oclif;
  }
  static description = [
    'Run a raw GraphQL query against the Linear API.',
    '',
    'Output',
    '- JSON shape:',
    '```ts',
    'type GraphqlPage = Record<string, unknown>;',
    '// Output without --paginate: GraphqlPage',
    '// Output with --paginate: GraphqlPage[]',
    '```',
  ].join('\n');

  static examples = [
    '<%= config.bin %> <%= command.id %> -q "{ viewer { id name } }"',
    '<%= config.bin %> <%= command.id %> -q @get_issues.graphql -v teamId=abc123',
    '<%= config.bin %> <%= command.id %> -q "{ issues { nodes { id } } }" --paginate --json',
  ];

  protected async execute({ parsed }: ExecCtxOf<this>): Promise<GraphqlResult> {
    const query = await this.loadQuery(parsed.query);
    const variables = await this.parseVariables(parsed.var);

    const runtimeVariables: Record<string, unknown> = { ...variables };
    const pages: GraphqlPage[] = [];
    const rawAfter = runtimeVariables['after'];
    let afterCursor = typeof rawAfter === 'string' ? rawAfter : undefined;
    const executor = this.getExecutor();

    while (true) {
      if (afterCursor !== undefined) {
        runtimeVariables['after'] = afterCursor;
      }

      const data = await executor(query, runtimeVariables);
      pages.push(data);

      if (!parsed.paginate) {
        break;
      }

      const pageInfo = this.findPageInfo(data);
      if (!pageInfo?.hasNextPage || !pageInfo.endCursor) {
        break;
      }
      if (afterCursor === pageInfo.endCursor) {
        break; // cursor did not advance
      }

      afterCursor = pageInfo.endCursor ?? undefined;
    }

    assertHasPage(pages);
    const output: GraphqlResult = parsed.paginate ? pages : pages[0];

    if (!this.jsonEnabled()) {
      const prettyDefault = process.stdout.isTTY;
      const pretty = parsed.pretty ?? prettyDefault;
      const json = pretty
        ? JSON.stringify(output, null, 2)
        : JSON.stringify(output);
      this.log(json);
    }

    return output;
  }

  // Helpers -----------------------------------------------------------------

  private async loadQuery(raw: string): Promise<string> {
    if (raw.startsWith('@')) {
      const filePath = raw.slice(1);
      const resolved = resolve(process.cwd(), filePath);
      try {
        return await fs.readFile(resolved, 'utf8');
      } catch (err) {
        this.error(
          `Cannot read query file ${filePath}: ${(err as Error).message}`
        );
      }
    }
    return raw;
  }

  private async parseVariables(
    flagValues: string[]
  ): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const pair of flagValues) {
      const eq = pair.indexOf('=');
      if (eq === -1) {
        this.error(`Invalid --var format: "${pair}" (expected key=value)`);
      }
      const key = pair.slice(0, eq);
      const rawVal = pair.slice(eq + 1);
      out[key] = await this.magicValue(rawVal);
    }
    return out;
  }

  private async magicValue(raw: string): Promise<unknown> {
    if (raw.startsWith('@')) {
      const filePath = raw.slice(1);
      const resolved = resolve(process.cwd(), filePath);
      try {
        return await fs.readFile(resolved, 'utf8');
      } catch (err) {
        this.error(
          `Cannot read variable file ${filePath}: ${(err as Error).message}`
        );
      }
    }

    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (/^-?\d+(?:\.\d+)?$/.test(raw)) return Number(raw);

    return raw;
  }

  private getExecutor(): GraphqlExecutor {
    if (globalThis.__CH_LINEAR_TEST_RAW_GQL__) {
      return globalThis.__CH_LINEAR_TEST_RAW_GQL__;
    }

    const authorization = resolveLinearAuthHeaderValue();
    const client = new GraphQLClient('https://api.linear.app/graphql', {
      headers: { Authorization: authorization },
    });
    return (q, vars) => client.request<GraphqlPage>(q, vars);
  }

  private findPageInfo(
    obj: unknown
  ): { hasNextPage: boolean; endCursor?: string | null } | undefined {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = this.findPageInfo(item);
        if (found) return found;
      }
      return undefined;
    }
    if (!isRecord(obj)) {
      return undefined;
    }
    const candidate = obj;
    const hasNext = candidate['hasNextPage'];
    const endCursor = candidate['endCursor'];
    if (typeof hasNext === 'boolean') {
      if (
        endCursor === undefined ||
        endCursor === null ||
        typeof endCursor === 'string'
      ) {
        const normalizedEndCursor =
          typeof endCursor === 'string'
            ? endCursor
            : endCursor === null
              ? null
              : undefined;
        return {
          hasNextPage: hasNext,
          ...(normalizedEndCursor !== undefined
            ? { endCursor: normalizedEndCursor }
            : {}),
        };
      }
    }
    for (const value of Object.values(candidate)) {
      const found = this.findPageInfo(value);
      if (found) return found;
    }
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertHasPage(
  pages: GraphqlPage[]
): asserts pages is [GraphqlPage, ...GraphqlPage[]] {
  if (pages.length === 0) {
    throw new Error('Invariant: GraphQL executor returned no data');
  }
}
