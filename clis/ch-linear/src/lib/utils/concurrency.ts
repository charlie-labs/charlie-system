/**
 * Small, dependency‑free concurrency‑limited mapper for Promises.
 *
 * Executes an async function over a list of items with at most `concurrency`
 * tasks in flight. Results preserve input order.
 *
 * @param items The input items to map over.
 * @param concurrency Maximum number of concurrent tasks (>= 1).
 * @param fn Async mapper invoked for each item with its index.
 * @returns Array of mapped results in the same order as `items`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const limit =
    Number.isFinite(concurrency) && concurrency > 0
      ? Math.floor(concurrency)
      : 1;
  const out: R[] = new Array(items.length);
  let idx = 0;

  // Worker loop: claim an index atomically and process until exhausted.
  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= items.length) break;
      out[i] = await fn(items[i] as T, i);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, limit) }, () => worker()));
  return out;
}
