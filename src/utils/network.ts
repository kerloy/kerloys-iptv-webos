/**
 * Resilient network fetch helper for LG webOS & Browser Dev environments.
 * - On packaged LG webOS TVs (`file://` protocol), direct fetch bypasses CORS natively.
 * - In local browser development (`http://localhost:5173`), falls back to `/__proxy?url=` if direct fetch is blocked by CORS.
 */
export async function smartFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const isLocalDevServer =
    typeof window !== 'undefined' &&
    window.location.protocol.startsWith('http') &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  try {
    const response = await fetch(url, options);
    return response;
  } catch (directError) {
    if (isLocalDevServer && !url.startsWith('/__proxy')) {
      const proxiedUrl = `/__proxy?url=${encodeURIComponent(url)}`;
      return fetch(proxiedUrl, options);
    }
    throw directError;
  }
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
