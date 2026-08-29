const LINEAR_REQUEST_SENTINEL = 'UNEXPECTED_LINEAR_REQUEST';
const linearEndpoint = 'https://api.linear.app/graphql';
const originalFetch = globalThis.fetch;

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (url.startsWith(linearEndpoint)) {
    process.stderr.write(`${LINEAR_REQUEST_SENTINEL}: ${url}\n`);
    return Promise.reject(
      new Error('Linear request blocked by regression test')
    );
  }

  return originalFetch(input, init);
}) as typeof fetch;
