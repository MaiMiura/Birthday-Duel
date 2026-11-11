import type { NextRequest } from "next/server";
import { periodKey, scorePeriod } from "@/lib/period";
import { fetchViews } from "@/lib/server/pageviews";
import { fetchSummary } from "@/lib/server/summary";
import type { Score } from "@/lib/types";

// 同じ記事・同じ集計期間のスコアは、サーバーが動いているあいだ使い回す
const cache = new Map<string, Score>();

/**
 * GET /api/score?title=記事名
 * 「このカードで勝負」を押したときに、その 1 人分の知名度スコア（日本語版 Wikipedia の閲覧数）と、
 * 公開画面に出す記事の冒頭（何をした人か。取れなければ null）を返す。
 */
export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  if (!title || title.length > 255) {
    return Response.json({ error: "記事名が正しくありません" }, { status: 400 });
  }
  const now = new Date();
  const period = scorePeriod(now);
  const key = `${periodKey(period)}/${title}`;
  // 記事の冒頭は閲覧数と同時に取る（取れなくても勝負には進める）
  const summaryJob = fetchSummary(title);
  let score = cache.get(key);
  if (!score) {
    score = await fetchViews(title, period);
    if (score.status === "ok") cache.set(key, score);
  }
  const summary = await summaryJob;
  if (score.status !== "ok") {
    return Response.json({ error: "スコアを取得できませんでした", detail: score.status === "failed" ? score.reason : "" }, { status: 502 });
  }
  return Response.json(
    { views: score.views, period, fetchedAt: now.toISOString(), summary },
    { headers: { "Cache-Control": "no-store" } },
  );
}
