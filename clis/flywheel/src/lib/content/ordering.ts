export function sortedCopy<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number
): readonly T[] {
  const result: T[] = [];
  for (const value of values) {
    const insertionIndex = findInsertionIndex(result, value, compare);
    result.splice(insertionIndex, 0, value);
  }
  return result;
}

function findInsertionIndex<T>(
  values: readonly T[],
  value: T,
  compare: (left: T, right: T) => number
): number {
  for (const [index, existing] of values.entries()) {
    if (compare(value, existing) < 0) {
      return index;
    }
  }
  return values.length;
}
