// 職業 → カテゴリーの根っこの表（lib/occupation-map.json）を作る・増やす。
// 指定した誕生日の人物の職業を集め、Wikidata で上位分類（P279）をたどって、たどり着いた根っこを記録する。
// 表にある職業は、アプリが Wikidata に問い合わせずに分類できるので、手札が速く作れる。
//
//   npm run build-occupation-map -- 8-13 10-29     指定した誕生日の人物の職業を足す
//   npm run build-occupation-map -- --all          366 日分（とても時間がかかる）
//   npm run build-occupation-map -- --rebuild 8-13 表を作り直す（categories.ts の根っこを変えたとき）
//
// 混雑で取れなかった分は、少し待ってから取り直す。

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { birthdayKey, daysInMonth, parseBirthday, type Birthday } from "../lib/birthday";
import { fetchBirthEntries } from "../lib/server/birthpage";
import { getOccupationInfo, getPersonDetails, resolveTitles } from "../lib/server/wikidata";

const MAP_FILE = path.join(import.meta.dirname, "..", "lib", "occupation-map.json");
const args = process.argv.slice(2);
const rebuild = args.includes("--rebuild");
let days: Birthday[] = [];
if (args.includes("--all")) {
  for (let month = 1; month <= 12; month++) for (let day = 1; day <= daysInMonth(month); day++) days.push({ month, day });
} else {
  days = args.filter((a) => !a.startsWith("--")).map((a) => {
    const b = parseBirthday(a);
    if (!b) throw new Error(`誕生日の形式が正しくありません: ${a}（例: 10-29）`);
    return b;
  });
}
if (days.length === 0) {
  console.error("使い方: npm run build-occupation-map -- 10-29 [8-13 ...] | --all  [--rebuild]");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Row = { label: string; roots: string[] };
const map: Record<string, Row> = rebuild ? {} : JSON.parse(readFileSync(MAP_FILE, "utf8"));

const occupations = new Set<string>();
for (const b of days) {
  for (let attempt = 1; ; attempt++) {
    try {
      const entries = await fetchBirthEntries(b.month, b.day);
      const resolved = await resolveTitles(entries.map((e) => e.title));
      const details = await getPersonDetails([...new Set([...resolved.values()].map((r) => r.qid))]);
      let added = 0;
      for (const d of details.values())
        for (const occ of d.occupations)
          if (!occupations.has(occ)) {
            occupations.add(occ);
            added++;
          }
      console.log(`${birthdayKey(b)}: ${details.size} 人、新しい職業 ${added} 件`);
      break;
    } catch (e) {
      if (attempt >= 3) {
        console.error(`${birthdayKey(b)}: 失敗 ${(e as Error).message}`);
        break;
      }
      await sleep(30_000);
    }
  }
}

let todo = [...occupations].filter((id) => rebuild || !map[id]);
console.log(`上位分類をたどる職業: ${todo.length} 件`);
for (let round = 1; todo.length && round <= 6; round++) {
  const info = await getOccupationInfo(todo, { useStaticMap: false });
  if (info.unresolved.length === 0) {
    for (const id of todo) map[id] = { label: info.labels.get(id) ?? id, roots: [...(info.ancestors.get(id) ?? [])].sort() };
    todo = [];
    break;
  }
  console.log(`  混雑で取れなかった項目 ${info.unresolved.length} 件。30 秒待って取り直します（${round} 回目）`);
  await sleep(30_000);
}
if (todo.length) console.error(`取りきれなかった職業 ${todo.length} 件は表に入れませんでした（もう一度実行してください）`);

const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1))));
writeFileSync(MAP_FILE, JSON.stringify(sorted, null, 1) + "\n");
console.log(`lib/occupation-map.json: ${Object.keys(sorted).length} 件`);
