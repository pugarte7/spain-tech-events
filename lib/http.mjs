// One request at a time per host, spaced out, retried when the host throttles.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const THROTTLE = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function client({ interval = 1200, tries = 3, timeout = 30_000, fetchImpl = fetch } = {}) {
  const queues = new Map();
  const get = (url) => {
    const host = new URL(url).host;
    const run = (queues.get(host) ?? Promise.resolve()).then(async () => {
      for (let attempt = 1; ; attempt++) {
        const res = await fetchImpl(url, {
          headers: { "user-agent": UA, "accept-language": "en;q=0.9,es;q=0.8" },
          signal: AbortSignal.timeout(timeout),
        }).catch((error) => ({ ok: false, status: 0, error }));
        if (res.ok) {
          const body = await res.text();
          await sleep(interval);
          return body;
        }
        if (attempt >= tries || !(res.status === 0 || THROTTLE.has(res.status)))
          throw new Error(`${res.status || res.error?.name || "error"} ${url}`);
        await sleep(interval * 4 ** attempt);
      }
    });
    queues.set(host, run.catch(() => {}));
    return run;
  };
  return { text: get, json: async (url) => JSON.parse(await get(url)) };
}

/** Every JSON-LD object in a page, lists flattened. */
export function jsonLd(html) {
  const out = [];
  for (const [, body] of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { out.push(...[JSON.parse(body)].flat()); } catch { /* a broken block is not ours to fix */ }
  }
  return out;
}
