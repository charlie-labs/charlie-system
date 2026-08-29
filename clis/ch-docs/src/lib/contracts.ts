export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type DocsDeps = Readonly<{
  readonly fetch: FetchLike;
}>;

export type ContentResult = Readonly<{
  readonly content: string;
}>;

export type JsonRecord = Readonly<Record<string, unknown>>;
