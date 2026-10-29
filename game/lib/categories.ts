// Wikidata の職業（P106）を、ゲームのカテゴリーへ対応付けるルール。
//
// 各カテゴリーは「根っこになる職業」の Q-ID を持つ。人物の職業がその Q-ID そのもの、
// またはその下位分類（P279 をたどって根っこに着く）なら、そのカテゴリーに入る。
// 職業名の文字列では判定しない。
//
// ルールを足すときは roots / exclude に Q-ID を追加するだけでよい。
// コメントの英語名は Wikidata のラベル。`npm run check-categories` で現在のラベルを確認できる。

import type { CategoryId } from "./types";

export interface CategoryRule {
  id: CategoryId;
  label: string;
  short: string;
  emoji: string;
  /** 例として画面に出す職業 */
  examples: string;
  roots: string[];
  /** roots の下位分類でも、このカテゴリーに入れたくない職業（その下位分類も含む） */
  exclude: string[];
}

export const CATEGORIES: CategoryRule[] = [
  {
    id: "entertainment",
    label: "芸能",
    short: "芸能",
    emoji: "🎬",
    examples: "俳優・声優・タレント・お笑いなど",
    roots: [
      "Q33999", // actor
      "Q2405480", // voice actor
      "Q245068", // comedian
      "Q947873", // television presenter
      "Q4610556", // model
      "Q2526255", // film director
      "Q17125263", // YouTuber
    ],
    exclude: [],
  },
  {
    id: "music",
    label: "音楽",
    short: "音楽",
    emoji: "🎵",
    examples: "歌手・音楽家・作曲家・指揮者など",
    roots: [
      "Q639669", // musician
      "Q177220", // singer
      "Q36834", // composer
      "Q158852", // conductor
      "Q753110", // songwriter
      "Q2252262", // rapper
      "Q130857", // disc jockey
    ],
    exclude: [],
  },
  {
    id: "sports",
    label: "スポーツ",
    short: "スポーツ",
    emoji: "⚽",
    examples: "いろいろなスポーツの選手など",
    roots: [
      "Q2066131", // athlete
      "Q13474373", // professional wrestler
      "Q628099", // association football coach
    ],
    exclude: [],
  },
  {
    id: "knowledge",
    label: "知・発明",
    short: "知・発明",
    emoji: "💡",
    examples: "科学者・発明家・数学者・思想家など",
    roots: [
      "Q901", // scientist
      "Q205375", // inventor
      "Q170790", // mathematician
      "Q4964182", // philosopher
      "Q81096", // engineer
      "Q39631", // physician
      "Q11631", // astronaut
      "Q1650915", // researcher
    ],
    exclude: [],
  },
  {
    id: "history",
    label: "歴史・社会",
    short: "歴史・社会",
    emoji: "🏛️",
    examples: "政治家・歴史上の指導者・社会活動家など",
    roots: [
      "Q82955", // politician
      "Q116", // monarch
      "Q47064", // military personnel
      "Q15253558", // activist
      "Q193391", // diplomat
      "Q38142", // samurai
      "Q11900058", // explorer
    ],
    exclude: [],
  },
];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

export function categoryRule(id: CategoryId): CategoryRule {
  const rule = CATEGORIES.find((c) => c.id === id);
  if (!rule) throw new Error(`unknown category: ${id}`);
  return rule;
}

// 「センシティブな人物を隠す」設定（既定でオン、設定でオフにできる）で隠す人物の判定ルール。
// 職業はカテゴリーと同じく、下位分類も含めて判定する。
export const SENSITIVE_OCCUPATIONS: { id: string; reason: string }[] = [
  { id: "Q488111", reason: "アダルト作品への出演" }, // pornographic actor
  { id: "Q2159907", reason: "犯罪者として記録" }, // criminal
  { id: "Q484188", reason: "犯罪者として記録" }, // serial killer
];

// 職業が登録されていない場合の補助として、Wikidata の日本語説明にこの語があれば隠す。
export const SENSITIVE_DESCRIPTION_WORDS: { pattern: RegExp; reason: string }[] = [
  { pattern: /AV女優|AV男優|アダルトビデオ|ポルノ/, reason: "アダルト作品への出演" },
];

/** 分類に使う職業 Q-ID の全部（上位分類の問い合わせに使う） */
export function allRootIds(): string[] {
  const ids = new Set<string>();
  for (const c of CATEGORIES) [...c.roots, ...c.exclude].forEach((id) => ids.add(id));
  SENSITIVE_OCCUPATIONS.forEach((s) => ids.add(s.id));
  return [...ids];
}
