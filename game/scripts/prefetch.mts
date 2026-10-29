// 誕生日の手札を前もって取得し、キャッシュ（data/hands/<集計期間>/<月日>.json）に保存する。
//
//   npm run prefetch -- 10-29 2-29     指定した誕生日
//   npm run prefetch -- --all          366 日すべて（時間がかかる。Wikimedia に負担をかけないよう 1 日ずつ）
//
// 集計期間が変わる月初に実行しておくと、その月は誰が開いてもすぐ表示される。

import { birthdayKey, daysInMonth, parseBirthday, type Birthday } from "../lib/birthday";
import { getHand } from "../lib/server/hand";

const args = process.argv.slice(2);
let days: Birthday[];
if (args.includes("--all")) {
  days = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= daysInMonth(month); day++) days.push({ month, day });
  }
} else {
  days = args.map((a) => {
    const b = parseBirthday(a);
    if (!b) throw new Error(`誕生日の形式が正しくありません: ${a}（例: 10-29）`);
    return b;
  });
}
if (days.length === 0) {
  console.error("使い方: npm run prefetch -- 10-29 [2-29 ...] | --all");
  process.exit(1);
}

let failed = 0;
for (const b of days) {
  const started = Date.now();
  try {
    const hand = await getHand(b.month, b.day);
    const counts = { ok: 0, failed: 0 };
    for (const p of hand.people) {
      if (p.score.status === "ok") counts.ok++;
      if (p.score.status === "failed") counts.failed++;
    }
    console.log(
      `${birthdayKey(b)}: ${hand.people.length} 人（スコア ${counts.ok} 件、失敗 ${counts.failed} 件）` +
        `${hand.truncated ? ` ※全 ${hand.totalFound} 人から上限で打ち切り` : ""} ${((Date.now() - started) / 1000).toFixed(1)}秒`,
    );
  } catch (e) {
    failed++;
    console.error(`${birthdayKey(b)}: 失敗 ${(e as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
