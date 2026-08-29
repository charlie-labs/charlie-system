import { type Command, Flags } from '@oclif/core';
import { expect, test } from 'bun:test';
import { z } from 'zod';

import {
  defineFlags,
  zDateYYYYMMDD,
  zMultiEnum,
  zPositiveInt,
  zStringList,
} from '../src/flags/index.js';

test('parse preserves omitted optional keys while materializing defined omitted outputs', () => {
  const manifest = defineFlags({
    optionalKey: {
      oclif: Flags.string(),
      schema: z.string().optional(),
    },
    defaultedKey: {
      oclif: Flags.string(),
      schema: z.string().default('fallback'),
    },
    listKey: {
      oclif: Flags.string({ multiple: true }),
      schema: zStringList,
    },
  });

  const parsed = manifest.parse({});

  expect(parsed.defaultedKey).toBe('fallback');
  expect(parsed.listKey).toEqual([]);
  expect(Object.keys(parsed)).toEqual(['defaultedKey', 'listKey']);
  expect(Object.hasOwn(parsed, 'optionalKey')).toBeFalse();
  expect(Object.hasOwn(parsed, 'defaultedKey')).toBeTrue();
  expect(Object.hasOwn(parsed, 'listKey')).toBeTrue();
});

test('parse preserves unknown raw keys for passthrough validation', () => {
  const manifest = defineFlags({
    known: {
      oclif: Flags.string(),
      schema: z.string().optional(),
    },
  }).withValidation((schema) => schema.passthrough());
  const raw = { extra: { retained: true } };

  const parsed = manifest.parse(
    raw as unknown as Parameters<typeof manifest.parse>[0]
  );
  const passthrough = parsed as typeof parsed & typeof raw;

  expect(passthrough.extra).toEqual({ retained: true });
  expect(Object.keys(passthrough)).toEqual(['extra']);
  expect(Object.hasOwn(passthrough, 'known')).toBeFalse();
  expect(Object.hasOwn(passthrough, 'extra')).toBeTrue();
});

test('multi-enum: repeats and comma-separated values with trim + de-dup', () => {
  const values = ['started', 'completed', 'error'] as const;
  const manifest = defineFlags({
    status: {
      oclif: Flags.option({
        options: values,
        multiple: true,
        delimiter: ',',
      })(),
      schema: zMultiEnum(values),
    },
  });

  // single string with commas
  const out1 = manifest.parse({ status: 'started, completed, started' });
  expect(out1.status).toEqual(['started', 'completed']);

  // array (repeats) and comma-mixed
  const out2 = manifest.parse({
    status: ['completed', 'error,started', 'completed'],
  });
  expect(out2.status).toEqual(['completed', 'error', 'started']);
});

test('date coercion: YYYY-MM-DD → Date at UTC midnight; invalid rejected', () => {
  const manifest = defineFlags({
    start: {
      oclif: Flags.string(),
      schema: zDateYYYYMMDD.optional(),
    },
  });

  const out = manifest.parse({ start: '2025-09-01' });
  expect(out.start instanceof Date).toBeTrue();
  // 00:00:00Z
  expect(
    out.start?.toISOString().startsWith('2025-09-01T00:00:00.000Z')
  ).toBeTrue();

  expect(() => manifest.parse({ start: '2025-13-40' as any })).toThrow();
});

test('bounded positive int with default and max enforcement', () => {
  const manifest = defineFlags({
    limit: {
      oclif: Flags.integer({ default: 100 }),
      schema: zPositiveInt({ default: 100, max: 1000 }),
    },
  });

  // default applies when undefined
  const out1 = manifest.parse({});
  expect(out1.limit).toBe(100);

  // coerce string and enforce max
  const out2 = manifest.parse({ limit: '250' });
  expect(out2.limit).toBe(250);

  expect(() => manifest.parse({ limit: '5000' as any })).toThrow();
});

test('cross-flag predicate: start < end sets issue path to end', () => {
  const manifest = defineFlags({
    start: { oclif: Flags.string(), schema: zDateYYYYMMDD.optional() },
    end: { oclif: Flags.string(), schema: zDateYYYYMMDD.optional() },
  }).withPredicate(
    'start < end',
    ({ start, end }) => !start || !end || start < end,
    { path: ['end'], message: 'end must be after start' }
  );

  const ok = manifest.parse({ start: '2025-09-01', end: '2025-09-02' });
  expect(
    ok.end?.toISOString().startsWith('2025-09-02T00:00:00.000Z')
  ).toBeTrue();

  try {
    manifest.parse({ start: '2025-09-03', end: '2025-09-02' });
    throw new Error('expected error');
  } catch (e: any) {
    expect(e.issues?.[0]?.path).toEqual(['end']);
  }
});

test('parseFromCommand preserves rejected parse errors and completes parse lifecycle', async () => {
  const manifest = defineFlags({});
  const originalError = new Error('parse rejected');
  const cmd = {
    parsed: false,
    parse: () => Promise.reject(originalError),
  } as unknown as Command;

  let caught: unknown;
  try {
    await manifest.parseFromCommand(cmd);
  } catch (error) {
    caught = error;
  }

  expect(caught).toBe(originalError);
  const parseState = cmd as Command & { parsed?: boolean };
  expect('parsed' in parseState && parseState.parsed).toBeTrue();
});
