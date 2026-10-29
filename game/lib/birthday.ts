// 誕生日（月日だけ）の扱い。生まれ年は持たない。

export interface Birthday {
  month: number;
  day: number;
}

// 2 月は 29 日まで選べるようにする（うるう日生まれの人も遊べるように）
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

export function isValidBirthday(month: number, day: number): boolean {
  return (
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(month)
  );
}

/** "10-29" / "1029" / "10/29" を Birthday にする。不正なら null。 */
export function parseBirthday(text: string | null | undefined): Birthday | null {
  if (!text) return null;
  const m = /^\s*(\d{1,2})\s*[-/]?\s*(\d{2})\s*$/.exec(text) ?? /^\s*(\d{1,2})\s*[-/]\s*(\d{1,2})\s*$/.exec(text);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  return isValidBirthday(month, day) ? { month, day } : null;
}

/** キャッシュのキーや URL に使う "10-29" 形式 */
export function birthdayKey({ month, day }: Birthday): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatBirthday({ month, day }: Birthday): string {
  return `${month}月${day}日`;
}

/** "1987-10-29" → "1987年10月29日"、紀元前は "紀元前100年10月29日" */
export function formatBirthDate(isoDate: string): string {
  const m = /^(-?)(\d+)-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  const year = Number(m[2]);
  const era = m[1] === "-" ? `紀元前${year}年` : `${year}年`;
  return `${era}${Number(m[3])}月${Number(m[4])}日`;
}
