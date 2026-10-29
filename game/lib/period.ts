// 知名度スコアの集計期間。どの端末でも同じ結果になるよう、すべて UTC で計算する
// （Wikimedia の閲覧数 API も UTC で日・月を区切っている）。

import type { ScorePeriod } from "./types";

const MONTHS = 12;

function ym(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** now の時点で「直近の完了した月」までの 12 か月。 */
export function scorePeriod(now: Date = new Date()): ScorePeriod {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 今月（未完了）
  return { start: ym(y, m - MONTHS), end: ym(y, m - 1) };
}

export function periodKey(p: ScorePeriod): string {
  return `${p.start}_${p.end}`;
}

export function samePeriod(a: ScorePeriod, b: ScorePeriod): boolean {
  return a.start === b.start && a.end === b.end;
}

/** 期間の初日と末日（"YYYYMMDD"）。閲覧数 API の引数に使う。 */
export function periodDays(p: ScorePeriod): { first: string; last: string } {
  const [sy, sm] = p.start.split("-").map(Number);
  const [ey, em] = p.end.split("-").map(Number);
  const lastDay = new Date(Date.UTC(ey, em, 0)).getUTCDate();
  return {
    first: `${sy}${String(sm).padStart(2, "0")}01`,
    last: `${ey}${String(em).padStart(2, "0")}${String(lastDay).padStart(2, "0")}`,
  };
}

/** 期間に含まれる月（"YYYY-MM"）の一覧 */
export function periodMonths(p: ScorePeriod): string[] {
  const [sy, sm] = p.start.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < MONTHS; i++) out.push(ym(sy, sm - 1 + i));
  return out;
}

/** "2025年10月〜2026年9月" */
export function formatPeriod(p: ScorePeriod): string {
  const f = (s: string) => {
    const [y, m] = s.split("-").map(Number);
    return `${y}年${m}月`;
  };
  return `${f(p.start)}〜${f(p.end)}`;
}
