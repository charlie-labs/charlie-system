import { Flags } from '@oclif/core';
import { expect, test } from 'bun:test';
import { z } from 'zod';

import {
  defineFlags,
  type ParsedOf,
  zDateYYYYMMDD,
  type zInt,
  zString,
} from '../src/flags/index.js';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;

type Zod4TypeAssertions = [
  Expect<Equal<z.input<typeof zDateYYYYMMDD>, string>>,
  Expect<Equal<z.output<typeof zDateYYYYMMDD>, Date>>,
  Expect<Equal<z.output<ReturnType<typeof zInt>>, number>>,
];

const manifest = defineFlags({
  name: {
    oclif: Flags.string({ required: true }),
    schema: zString(),
  },
  start: {
    oclif: Flags.string(),
    schema: zDateYYYYMMDD.optional(),
  },
}).withValidation((schema) =>
  schema.superRefine(({ name }, ctx) => {
    if (name.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'name must contain at least two characters',
        path: ['name'],
      });
    }
  })
);

type Parsed = ParsedOf<typeof manifest>;
type ManifestTypeAssertions = [
  Expect<Equal<Parsed['name'], string>>,
  Expect<Equal<Parsed['start'], Date | undefined>>,
];

test('Zod 4 schemas retain manifest input/output inference and validation', () => {
  const typeAssertions: [...Zod4TypeAssertions, ...ManifestTypeAssertions] = [
    true,
    true,
    true,
    true,
    true,
  ];
  expect(typeAssertions.every(Boolean)).toBeTrue();

  const parsed: Parsed = manifest.parse({
    name: ' Charlie ',
    start: '2026-06-24',
  });

  expect(parsed.name).toBe('Charlie');
  expect(parsed.start?.toISOString()).toBe('2026-06-24T00:00:00.000Z');
  expect(() => manifest.parse({ name: 'x' })).toThrow(
    'name must contain at least two characters'
  );
});
