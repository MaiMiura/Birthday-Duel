// 外部 API への HTTP アクセス（サーバー側だけで使う）。

// Wikimedia の API はクライアントを識別できる User-Agent を求めている。
// https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
export const USER_AGENT =
  process.env.WIKIMEDIA_USER_AGENT ??
  "BirthdayDuel/0.1 (https://github.com/MaiMiura/Birthday-Duel; birthday card game)";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class TimeoutError extends Error {}

export interface FetchJsonOptions {
  timeoutMs: number;
  init?: RequestInit;
  /** 429 / 5xx のときに再試行する回数 */
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 429 / 503 の Retry-After（秒）に従って待つ時間。なければ 1 秒、最大 10 秒 */
export function retryAfterMs(res: Response, fallbackMs = 1000): number {
  const sec = Number(res.headers.get("retry-after"));
  return Number.isFinite(sec) && sec > 0 ? Math.min(sec * 1000, 10_000) : fallbackMs;
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
  return fetchBody(url, opts, (text) => JSON.parse(text) as T);
}

/** 本文をそのまま文字列で受け取る（Wikipedia の生の wikitext など） */
export async function fetchText(url: string, opts: FetchJsonOptions): Promise<string> {
  return fetchBody(url, { ...opts, init: { ...opts.init, headers: { Accept: "text/plain, */*", ...opts.init?.headers } } }, (t) => t);
}

async function fetchBody<T>(url: string, opts: FetchJsonOptions, parse: (text: string) => T): Promise<T> {
  const retries = opts.retries ?? 1;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...opts.init,
        headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...opts.init?.headers },
        signal: AbortSignal.timeout(opts.timeoutMs),
      });
    } catch (e) {
      const err = e as Error;
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        throw new TimeoutError(`timeout after ${opts.timeoutMs}ms: ${new URL(url).host}`);
      }
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      // fetch の "fetch failed" だけでは原因が分からないので、接続先と原因を添える
      const cause = (err as Error & { cause?: Error }).cause;
      throw new Error(`${new URL(url).host} に接続できません: ${cause?.message ?? err.message}`);
    }
    if (res.ok) {
      // 応答の本文を読んでいる途中でも時間切れになりうる
      let text: string;
      try {
        text = await res.text();
      } catch (e) {
        const err = e as Error;
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          throw new TimeoutError(`timeout after ${opts.timeoutMs}ms: ${new URL(url).host}`);
        }
        throw err;
      }
      // 混雑していると、応答が途中で打ち切られることがある（JSON が壊れる）
      try {
        return parse(text);
      } catch {
        if (attempt < retries) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        if (/TimeoutException|timeout/i.test(text.slice(-2000))) {
          throw new TimeoutError(`${new URL(url).host} の処理が時間切れになりました`);
        }
        throw new Error(`${new URL(url).host} の応答が途中で切れました（混雑や時間切れの可能性）`);
      }
    }
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await res.arrayBuffer().catch(() => undefined);
      await sleep(retryAfterMs(res, 1000 * (attempt + 1)));
      continue;
    }
    throw new HttpError(res.status, `HTTP ${res.status}: ${new URL(url).host}`);
  }
}

/** items を最大 concurrency 個ずつ並行して処理する（結果の順序は items と同じ）。 */
export async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
