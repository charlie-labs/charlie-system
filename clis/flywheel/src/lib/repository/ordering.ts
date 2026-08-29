export function sortedCopy<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number
): readonly T[] {
  if (values.length < 2) {
    return [...values];
  }
  const middle = Math.floor(values.length / 2);
  return merge(
    sortedCopy(values.slice(0, middle), compare),
    sortedCopy(values.slice(middle), compare),
    compare
  );
}

function merge<T>(
  left: readonly T[],
  right: readonly T[],
  compare: (left: T, right: T) => number
): readonly T[] {
  const result: T[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    const leftValue = left[leftIndex];
    const rightValue = right[rightIndex];
    if (leftValue === undefined || rightValue === undefined) {
      break;
    }
    if (compare(leftValue, rightValue) <= 0) {
      result.push(leftValue);
      leftIndex += 1;
    } else {
      result.push(rightValue);
      rightIndex += 1;
    }
  }
  return [...result, ...left.slice(leftIndex), ...right.slice(rightIndex)];
}
