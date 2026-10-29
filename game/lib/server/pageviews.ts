// 日本語版 Wikipedia の記事閲覧数（Wikimedia Analytics API の per-article）。
// https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html

import { periodDays, periodMonths } from "../period";
import type { Score, ScorePeriod } from "../types";
import { fetchJson, HttpError, mapLimit } from "./http";

const BASE =
  process.env.PAGEVIEWS_API_BASE ??
  "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ja.wikipedia.org/all-access/user";

interface PageviewsResponse {
  items?: { timestamp: string; views: number }[];
}

/**
 * 記事 1 本の、期間中の閲覧数（人間による閲覧 = agent "user"）の合計。
 * - 404 は「期間中に閲覧記録がない」という API の応答なので 0 回として扱う
 * - それ以外の HTTP エラーやタイムアウトは失敗（値不明）にする
 */
export async function fetchViews(jaTitle: string, period: ScorePeriod): Promise<Score> {
  const { first, last } = periodDays(period);
  const article = encodeURIComponent(jaTitle.replace(/ /g, "_"));
  const url = `${BASE}/${article}/monthly/${first}/${last}`;
  try {
    const data = await fetchJson<PageviewsResponse>(url, { timeoutMs: 15_000, retries: 2 });
    const months = new Set(periodMonths(period));
    let views = 0;
    for (const item of data.items ?? []) {
      // timestamp は "2025100100" 形式。期間外の月が混ざっても数えない
      const month = `${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}`;
      if (months.has(month)) views += item.views;
    }
    return { status: "ok", views };
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return { status: "ok", views: 0 };
    return { status: "failed", reason: (e as Error).message };
  }
}

export async function fetchViewsMany(
  titles: string[],
  period: ScorePeriod,
  concurrency = Number(process.env.PAGEVIEWS_CONCURRENCY ?? 12),
): Promise<Score[]> {
  return mapLimit(titles, concurrency, (t) => fetchViews(t, period));
}
