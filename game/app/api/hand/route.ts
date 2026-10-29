import type { NextRequest } from "next/server";
import { parseBirthday } from "@/lib/birthday";
import { TimeoutError } from "@/lib/server/http";
import { getHand, retryFailedScores } from "@/lib/server/hand";

// 初回の取得（Wikidata + 数百件の閲覧数）は数十秒かかることがある
export const maxDuration = 300;

/**
 * GET /api/hand?date=10-29          誕生日の手札（実データ）
 * GET /api/hand?date=10-29&retry=1  スコア取得に失敗したカードだけ取り直す
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const birthday = parseBirthday(params.get("date"));
  if (!birthday) {
    return Response.json({ error: "誕生日の形式が正しくありません", kind: "bad-request" }, { status: 400 });
  }
  try {
    const hand =
      params.get("retry") === "1"
        ? await retryFailedScores(birthday.month, birthday.day)
        : await getHand(birthday.month, birthday.day);
    return Response.json({ hand }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const timeout = e instanceof TimeoutError;
    console.error("hand fetch failed", e);
    return Response.json(
      {
        error: timeout
          ? "人物データの取得に時間がかかりすぎました"
          : "人物データ（Wikipedia・Wikidata）を取得できませんでした",
        detail: (e as Error).message,
        kind: timeout ? "timeout" : "upstream",
      },
      { status: timeout ? 504 : 502 },
    );
  }
}
