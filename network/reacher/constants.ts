export type SocksProxy = { host: string; port: number };

/** Working SOCKS5 proxies for SMTP (deduped). Rotated per check / retry. */
export const PROXY_POOL: SocksProxy[] = [
  { host: "103.119.1.160", port: 5555 },
  { host: "220.158.232.118", port: 1080 },
  { host: "209.50.255.91", port: 1080 },
  { host: "45.74.31.42", port: 4089 },
  { host: "103.124.172.134", port: 1080 },
];

/** @deprecated Prefer nextProxy() — kept for callers that expect a single default. */
export const PROXY_HOST = PROXY_POOL[0]?.host ?? "127.0.0.1";
export const PROXY_PORT = PROXY_POOL[0]?.port ?? 1080;

let cursor = 0;

/** Round-robin next proxy from the pool (thread-safe enough for Node event loop). */
export function nextProxy(): SocksProxy {
  if (PROXY_POOL.length === 0) {
    return { host: PROXY_HOST, port: PROXY_PORT };
  }
  const proxy = PROXY_POOL[cursor % PROXY_POOL.length];
  cursor = (cursor + 1) % PROXY_POOL.length;
  return proxy;
}

/** Pick a proxy different from `avoid` when possible (retries). */
export function nextProxyExcept(avoid?: SocksProxy | null): SocksProxy {
  if (PROXY_POOL.length <= 1 || !avoid) return nextProxy();
  for (let i = 0; i < PROXY_POOL.length; i++) {
    const proxy = nextProxy();
    if (proxy.host !== avoid.host || proxy.port !== avoid.port) return proxy;
  }
  return nextProxy();
}
