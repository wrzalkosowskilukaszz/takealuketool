/** fetch with a timeout and explicit proxy support (HTTPS_PROXY). */

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
let fetchPromise: Promise<FetchFn> | null = null;

/**
 * Node's global fetch ignores HTTPS_PROXY. When a proxy is configured (e.g. a sandbox), use undici's own
 * fetch with EnvHttpProxyAgent; otherwise the global fetch.
 */
function getFetch(): Promise<FetchFn> {
  if (!fetchPromise) {
    const proxied = Boolean(process.env.HTTPS_PROXY || process.env.https_proxy);
    fetchPromise = proxied
      ? import("undici")
          .then((u) => {
            const agent = new u.EnvHttpProxyAgent();
            return ((url: string, init: RequestInit) =>
              u.fetch(url, {
                ...(init as object),
                dispatcher: agent,
              } as never) as unknown as Promise<Response>) as FetchFn;
          })
          .catch(() => globalThis.fetch.bind(globalThis))
      : Promise.resolve(globalThis.fetch.bind(globalThis));
  }
  return fetchPromise;
}

export async function httpFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20_000);
  try {
    const f = await getFetch();
    const { timeoutMs: _t, ...rest } = init;
    return await f(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}
