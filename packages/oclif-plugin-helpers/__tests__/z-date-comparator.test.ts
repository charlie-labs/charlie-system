import { expect, test } from 'bun:test';

import { zDateComparator, zDateComparatorList } from '../src/flags/index.js';

test('zDateComparator: parses operators and YYYY-MM-DD (UTC midnight)', () => {
  const a = zDateComparator.parse('>= 2025-01-01');
  expect(a.op).toBe('gte');
  expect(
    a.date.toISOString().startsWith('2025-01-01T00:00:00.000Z')
  ).toBeTrue();

  const b = zDateComparator.parse('<2024-12-31');
  expect(b.op).toBe('lt');
  expect(
    b.date.toISOString().startsWith('2024-12-31T00:00:00.000Z')
  ).toBeTrue();

  const c = zDateComparator.parse('=2025-02-28');
  expect(c.op).toBe('eq');
  expect(
    c.date.toISOString().startsWith('2025-02-28T00:00:00.000Z')
  ).toBeTrue();
});

test('zDateComparator: rejects bad operator and bad dates', () => {
  expect(() => zDateComparator.parse('==2025-01-01' as any)).toThrow();
  expect(() => zDateComparator.parse('>= 2025-13-01' as any)).toThrow();
});

test('zDateComparator: trims outer whitespace and accepts tabs between op/date', () => {
  const d = zDateComparator.parse('  <=2025-01-01\t');
  expect(d.op).toBe('lte');
  expect(d.date.toISOString().startsWith('2025-01-01')).toBeTrue();

  const e = zDateComparator.parse('\t>\t2025-03-01   ');
  expect(e.op).toBe('gt');
  expect(e.date.toISOString().startsWith('2025-03-01')).toBeTrue();
});

test('zDateComparator: missing operator is rejected', () => {
  expect(() => zDateComparator.parse('2025-01-01' as any)).toThrow();
});

test('zDateComparatorList: undefined → [] and comma/repeat parsing', () => {
  expect(zDateComparatorList.parse(undefined)).toEqual([]);

  const list = zDateComparatorList.parse('>=2025-01-01,<2025-02-01');
  expect(list.map((c) => c.op)).toEqual(['gte', 'lt']);
  expect(list[0]!.date.toISOString().startsWith('2025-01-01')).toBeTrue();
  expect(list[1]!.date.toISOString().startsWith('2025-02-01')).toBeTrue();
});

test('zDateComparatorList: de-duplicates identical tokens and attaches index on error', () => {
  const deduped = zDateComparatorList.parse([
    '>=2025-01-01',
    '<2025-02-01',
    '>=2025-01-01', // duplicate token → removed by zStringList
  ]);
  expect(deduped.length).toBe(2);
  expect(deduped.map((c) => c.op)).toEqual(['gte', 'lt']);

  const bad = zDateComparatorList.safeParse(['>=2025-01-01', 'bogus'] as any);
  expect(bad.success).toBeFalse();
  if (!bad.success) {
    // first issue should point at array index 1
    const issue = bad.error.issues[0]!;
    expect(issue.path).toEqual([1]);
  }
});
