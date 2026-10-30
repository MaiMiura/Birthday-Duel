import type { NextRequest } from "next/server";
import { periodKey, scorePeriod } from "@/lib/period";
import { fetchViews } from "@/lib/server/pageviews";
import type { Score } from "@/lib/types";

// 同じ記事・同じ集計期間のスコアは、サーバーが動いているあいだ使い回す
const cache = new Map<string, Score>();

/**
 * GET /api/score?title=記事名
 * 「このカードで勝負」を押したときに、その 1 人分の知名度スコア（日本語版 Wikipedia の閲覧数）を返す。
 */
export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  if (!title || title.length > 255) {
    return Response.json({ error: "記事名が正しくありません" }, { status: 400 });
  }
  const now = new Date();
  const period = scorePeriod(now);
  const key = `${periodKey(period)}/${title}`;
  let score = cache.get(key);
  if (!score) {
    score = await fetchViews(title, period);
    if (score.status === "ok") cache.set(key, score);
  }
  if (score.status !== "ok") {
    return Response.json({ error: "スコアを取得できませんでした", detail: score.status === "failed" ? score.reason : "" }, { status: 502 });
  }
  return Response.json(
    { views: score.views, period, fetchedAt: now.toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
