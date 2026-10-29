// lib/categories.ts に書いた職業 Q-ID の、Wikidata 上の現在のラベルを表示する。
// ルールを追加・修正したときに、意図した職業を指しているかの確認に使う。
//
//   npm run check-categories

import { CATEGORIES, SENSITIVE_OCCUPATIONS } from "../lib/categories";
import { getLabels } from "../lib/server/wikidata";

const groups: [string, string[]][] = [
  ...CATEGORIES.flatMap((c): [string, string[]][] => [
    [`${c.label}（含める）`, c.roots],
    ...(c.exclude.length ? [[`${c.label}（除外）`, c.exclude] as [string, string[]]] : []),
  ]),
  ["子ども向けフィルター", SENSITIVE_OCCUPATIONS.map((s) => s.id)],
];
let labels: Map<string, string>;
try {
  labels = await getLabels([...new Set(groups.flatMap(([, ids]) => ids))]);
} catch (e) {
  console.error(`Wikidata に問い合わせできませんでした: ${(e as Error).message}`);
  process.exit(1);
}
for (const [name, ids] of groups) {
  console.log(`\n${name}`);
  for (const id of ids) console.log(`  ${id.padEnd(10)} ${labels.get(id) ?? "（見つかりません）"}`);
}
