export type StageReport = Readonly<{
  readonly elapsedMs: number;
  readonly name: string;
}>;

export async function timedStage<T>(
  stages: StageReport[],
  name: string,
  operation: () => T | PromiseLike<T>
): Promise<T> {
  const started = performance.now();
  const result = await operation();
  stages.push({ elapsedMs: elapsedMilliseconds(started), name });
  return result;
}

export function elapsedMilliseconds(started: number): number {
  return Number((performance.now() - started).toFixed(3));
}
