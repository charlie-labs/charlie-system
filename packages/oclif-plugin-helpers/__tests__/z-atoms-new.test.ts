import { expect, test } from 'bun:test';

import { zInt, zIntList, zString } from '../src/flags/index.js';

test('zString: trims by default and accepts number inputs', () => {
  expect(zString().parse('  hello  ')).toBe('hello');
  expect(zString().parse(123)).toBe('123');
  // Optionality is opt-in at call sites
  expect(zString().optional().parse(undefined)).toBeUndefined();
});

test('zInt: coerces from string/number and enforces finite integer', () => {
  expect(zInt().parse(' 42 ')).toBe(42);
  expect(zInt().parse(7)).toBe(7);
  // rejects decimals
  expect(() => zInt().parse('3.14')).toThrow();
  expect(() => zInt().parse(3.14)).toThrow();
  // rejects blank by default
  expect(() => zInt().parse('   ' as any)).toThrow();
  // Optionality via Zod composition
  expect(zInt().optional().parse(undefined)).toBeUndefined();
});

test('zInt: rejects non-base-10 string lexemes', () => {
  // hex string → reject
  expect(() => zInt().parse('0x10' as any)).toThrow();
  // scientific notation string → reject
  expect(() => zInt().parse('1e2' as any)).toThrow();
  // integer-looking decimal string → reject
  expect(() => zInt().parse('3.0' as any)).toThrow();
  // numeric inputs are still accepted when they are integers
  expect(zInt().parse(100)).toBe(100);
});

test('zIntList: parses repeats/comma-delimited, enforces bounds, and de-dupes', () => {
  // repeats + commas → [1,2,3]
  expect(zIntList().parse(['1', '2,3', '2'])).toEqual([1, 2, 3]);

  // min bound (default: 1)
  const err = zIntList().safeParse('0' as any);
  expect(err.success).toBeFalse();

  // numeric de-dupe collapses "01,1" → [1]
  expect(zIntList().parse('01,1')).toEqual([1]);

  // when dedupe=false, preserve exact repeats and post-coercion duplicates
  expect(zIntList({ dedupe: false }).parse('01,1')).toEqual([1, 1]);
  expect(zIntList({ dedupe: false }).parse('1,1')).toEqual([1, 1]);
});

test('zIntList: rejects non-base-10 string lexemes', () => {
  expect(() => zIntList().parse('0x10' as any)).toThrow();
  expect(() => zIntList().parse('1e2' as any)).toThrow();
  expect(() => zIntList().parse('3.0' as any)).toThrow();
});

test('zIntList: accepts numeric tokens and rejects non-integer numeric tokens', () => {
  expect(zIntList().parse([1, 2, '3'])).toEqual([1, 2, 3]);
  expect(() => zIntList().parse([1, 3.14] as any)).toThrow();
});
