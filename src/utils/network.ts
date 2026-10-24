/**
 * Detects whether we are running inside a browser dev server (`http:` / `https:`)
 * rather than a packaged LG webOS TV app (`file:` protocol).
 */
export function isBrowserDevServer(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:')
  );
}

/**
 * Converts an external stream URL (Xtream Codes / M3U) into a proxied stream URL
 * when running in the desktop browser so CORS, 302 load-balancer redirects, and
 * User-Agent checks are handled transparently.
 * On packaged LG webOS TVs (`file://`), returns the direct URL.
 */
export function toPlayableStreamUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  if (
    isBrowserDevServer() &&
    /^https?:\/\//i.test(rawUrl) &&
    !rawUrl.startsWith(window.location.origin)
  ) {
    return `/__proxy?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

/**
 * Resilient network fetch helper for LG webOS & Browser Dev environments.
 * - In local browser development (`http://localhost:5173`), routes external URLs through `/__proxy?url=` immediately.
 * - On packaged LG webOS TVs (`file://` protocol), direct fetch bypasses CORS natively.
 */
export async function smartFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  if (
    isBrowserDevServer() &&
    /^https?:\/\//i.test(url) &&
    !url.startsWith('/__proxy')
  ) {
    const proxiedUrl = `/__proxy?url=${encodeURIComponent(url)}`;
    return fetch(proxiedUrl, options);
  }

  return fetch(url, options);
}

export async function smartFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await smartFetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function smartFetchText(
  url: string,
  options?: RequestInit
): Promise<string> {
  const res = await smartFetch(url, options);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.text();
}
