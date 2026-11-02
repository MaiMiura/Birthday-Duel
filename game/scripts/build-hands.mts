// 誕生日ごとの手札（人物・カテゴリー・写真）を前もって作り、public/hands/<月-日>.json に書き出す。
// アプリはこのファイルがあればそれを読む（誕生日を入れてすぐ手札が出る）。なければその場で作る。
// 各カテゴリーは、日本語版 Wikipedia の閲覧数で上位 20 人に絞る（図鑑では全員見られる）。
// 閲覧数そのものは入れない（「このカードで勝負」を押したときに、その時点の値を 1 人分だけ取る）。
//
//   npm run build-hands -- 10-29 2-29        指定した誕生日
//   npm run build-hands -- --month 1          1 月の全日
//   npm run build-hands -- --all              366 日すべて
//   付けるもの:
//   （なし）    ファイルがない日だけ作る
//   --stale     ファイルがない日と、今月の閲覧数で選び直していない（古い）日だけ作る（毎月の作り直し用）
//   --force     すでにあるファイルも、すべて作り直す
//
// 一部の人を取れなかった日や、閲覧数を取れなかった人が多い日（混雑など）はファイルを書かない
// （前のファイルがあればそのまま残る）。次に実行したときに作り直す。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { birthdayKey, daysInMonth, parseBirthday, type Birthday } from "../lib/birthday";
import { scorePeriod } from "../lib/period";
import { buildHand, rankHand } from "../lib/server/hand";
import type { Hand } from "../lib/types";

const PER_CATEGORY = 20;

const OUT_DIR = path.join(import.meta.dirname, "..", "public", "hands");
const args = process.argv.slice(2);
const force = args.includes("--force");
const stale = args.includes("--stale");
const currentPeriod = scorePeriod();

/** すでにあるファイルを、今回は作らずにそのまま使うか */
function upToDate(file: string): boolean {
  if (force || !existsSync(file)) return false;
  if (!stale) return true;
  try {
    // 今月の集計期間の閲覧数で上位を選んだファイルなら、作り直さない
    const hand = JSON.parse(readFileSync(file, "utf8")) as Hand;
    return hand.ranked?.period.end === currentPeriod.end;
  } catch {
    return false;
  }
}
const monthArg = args.indexOf("--month");

let days: Birthday[] = [];
const allDaysOf = (month: number) => Array.from({ length: daysInMonth(month) }, (_, i) => ({ month, day: i + 1 }));
if (args.includes("--all")) {
  for (let month = 1; month <= 12; month++) days.push(...allDaysOf(month));
} else if (monthArg >= 0) {
  const month = Number(args[monthArg + 1]);
  if (!(month >= 1 && month <= 12)) throw new Error("--month のあとに 1〜12 を指定してください");
  days = allDaysOf(month);
} else {
  days = args
    .filter((a) => !a.startsWith("--"))
    .map((a) => {
      const b = parseBirthday(a);
      if (!b) throw new Error(`誕生日の形式が正しくありません: ${a}（例: 10-29）`);
      return b;
    });
}
if (days.length === 0) {
  console.error("使い方: npm run build-hands -- 10-29 [2-29 ...] | --month 1 | --all  [--stale | --force]");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
let written = 0;
let skipped = 0;
const failed: string[] = [];
for (const b of days) {
  const key = birthdayKey(b);
  const file = path.join(OUT_DIR, `${key}.json`);
  if (upToDate(file)) {
    skipped++;
    continue;
  }
  const started = Date.now();
  try {
    const built = await buildHand(b.month, b.day);
    if (built.truncated) {
      failed.push(`${key}（${built.totalFound - built.people.length} 人を取れず）`);
      console.log(`${key}: 一部を取れなかったので書き出しません`);
      continue;
    }
    const { hand, failedScores } = await rankHand(built, { perCategory: PER_CATEGORY });
    const candidates = built.people.filter((p) => p.categories.length > 0).length;
    // 閲覧数を取れなかった人が多いと、上位 20 人が正しく選べないので書かない
    if (failedScores > Math.max(3, candidates * 0.05)) {
      failed.push(`${key}（閲覧数を ${failedScores} 人取れず）`);
      console.log(`${key}: 閲覧数を ${failedScores}/${candidates} 人取れなかったので書き出しません`);
      continue;
    }
    // 段階ごとの時間は、配るファイルには要らない
    writeFileSync(file, JSON.stringify({ ...hand, timings: undefined }));
    written++;
    const inHand = hand.people.filter((p) => p.categories.length > 0).length;
    console.log(`${key}: ${hand.people.length} 人（勝負に出せる ${inHand} 人） ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
  } catch (e) {
    failed.push(`${key}（${(e as Error).message}）`);
    console.log(`${key}: 失敗 ${(e as Error).message}`);
  }
}
console.log(`書き出し ${written} 日、そのまま ${skipped} 日、作れなかった ${failed.length} 日`);
if (failed.length) console.log(`作れなかった日（もう一度実行すると作り直します）: ${failed.join("、")}`);
