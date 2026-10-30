// 画面に依存しないゲームのルール（どのカードが勝負に使えるか、スコアの表示など）。

import { CATEGORY_IDS } from "./categories";
import type { CategoryId, Hand, Person, ScorePeriod, SelectedCard } from "./types";

export type CardState =
  | { playable: true }
  | { playable: false; label: string; detail: string };

export function cardState(person: Person, category: CategoryId | "all"): CardState {
  const s = person.score;
  if (s.status === "no-article") {
    return { playable: false, label: "スコア対象外", detail: "日本語版 Wikipedia の記事がないため、勝負には使えません。" };
  }
  if (person.categories.length === 0) {
    return { playable: false, label: "部門なし", detail: "どのカテゴリーにも入らないため、勝負には使えません。" };
  }
  if (s.status === "pending") {
    // まだ取っていないだけ。選んだときに取って、取れなければ勝負に使えない
    return category !== "all" && !person.categories.includes(category)
      ? { playable: false, label: "別のカテゴリー", detail: "このカテゴリーの勝負には使えません。" }
      : { playable: true };
  }
  if (s.status === "failed") {
    return { playable: false, label: "スコア未取得", detail: "閲覧数を取得できなかったため、今は勝負に使えません。再試行してください。" };
  }
  if (s.status !== "ok") {
    return { playable: false, label: "スコア未取得", detail: "閲覧数を取得していないため、勝負には使えません。" };
  }
  if (category !== "all" && !person.categories.includes(category)) {
    return { playable: false, label: "別のカテゴリー", detail: "このカテゴリーの勝負には使えません。" };
  }
  return { playable: true };
}

export interface VisibleOptions {
  kidsFilter: boolean;
  hiddenIds: string[];
}

export function visiblePeople(hand: Hand, category: CategoryId | "all", opts: VisibleOptions): Person[] {
  const hidden = new Set(opts.hiddenIds);
  return hand.people.filter(
    (p) =>
      !hidden.has(p.id) &&
      !(opts.kidsFilter && p.sensitive) &&
      (category === "all" || p.categories.includes(category)),
  );
}

/** 「このカードで勝負」を押したときに取った、その 1 人分のスコア */
export interface FetchedScore {
  views: number;
  period: ScorePeriod;
  fetchedAt: string;
}

export function selectCard(
  hand: Hand,
  person: Person,
  category: CategoryId,
  now = new Date(),
  fetched?: FetchedScore,
): SelectedCard {
  const state = cardState(person, category);
  const views = person.score.status === "ok" ? person.score.views : fetched?.views;
  if (!state.playable || views === undefined) {
    throw new Error("このカードは勝負に使えません");
  }
  // 選んだ時点の値をコピーして固定する（公開までにデータが更新されても変わらない）
  return {
    person: structuredClone(person),
    category,
    mode: hand.mode,
    period: { ...(fetched?.period ?? hand.period) },
    fetchedAt: fetched?.fetchedAt ?? hand.fetchedAt,
    views,
    selectedAt: now.toISOString(),
  };
}

/**
 * 次の勝負のカテゴリー。どの端末でも同じ順（芸能 → 音楽 → スポーツ → 知・発明 → 歴史・社会 → 芸能…）で進むので、
 * みんなが「次の勝負へ」を押せば同じカテゴリーになる。カードのないカテゴリーも飛ばさない（端末ごとにずれないように）。
 */
export function nextCategory(current: CategoryId): CategoryId {
  const i = CATEGORY_IDS.indexOf(current);
  return CATEGORY_IDS[(i + 1) % CATEGORY_IDS.length];
}

/** 1234567 → "1,234,567" */
export function formatViews(n: number): string {
  return n.toLocaleString("ja-JP");
}

/** 1234567 → "約123万回"（ひと目で大きさが伝わる言い方） */
export function approxViews(n: number): string {
  if (n >= 100_000_000) return `約${Math.floor(n / 10_000_000) / 10}億回`;
  if (n >= 10_000) return `約${Math.floor(n / 10_000).toLocaleString("ja-JP")}万回`;
  return `${n.toLocaleString("ja-JP")}回`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  // 取得日は UTC の日付で表示（集計期間と同じ基準）
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（UTC）`;
}
