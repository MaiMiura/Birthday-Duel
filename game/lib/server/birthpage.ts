// 日本語版 Wikipedia の日付ページ（「8月13日」など）の「誕生日」の節から、その日生まれの人物を取る。
// 人が選んで載せている一覧なので、全員ではなく「その日生まれの著名な人」の一覧になる。

import { fetchJson } from "./http";

export const JA_API = process.env.JA_WIKIPEDIA_API ?? "https://ja.wikipedia.org/w/api.php";

export interface BirthEntry {
  /** リンク先の記事名（リダイレクトの解決前） */
  title: string;
  /** 生まれ年（紀元前は負の数）。分からなければ null */
  year: number | null;
  /** 一覧に書かれている短い説明（「歌手」など）。なければ null */
  note: string | null;
}

interface ParseResponse {
  parse?: { wikitext?: string };
  error?: { info?: string };
}

export async function fetchBirthEntries(month: number, day: number): Promise<BirthEntry[]> {
  const params = new URLSearchParams({
    action: "parse",
    page: `${month}月${day}日`,
    prop: "wikitext",
    redirects: "1",
    format: "json",
    formatversion: "2",
  });
  const data = await fetchJson<ParseResponse>(`${JA_API}?${params}`, { timeoutMs: 20_000, retries: 2 });
  const wikitext = data.parse?.wikitext;
  if (!wikitext) throw new Error(`Wikipedia の「${month}月${day}日」のページを読めませんでした`);
  const entries = parseBirths(wikitext);
  if (entries.length === 0) throw new Error(`Wikipedia の「${month}月${day}日」のページに誕生日の一覧が見つかりませんでした`);
  return entries;
}

/** wikitext から「== 誕生日 ==」の節を取り出して、1 行ずつ人物を読む */
export function parseBirths(wikitext: string): BirthEntry[] {
  const text = wikitext
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  const start = /^==\s*誕生日\s*==\s*$/m.exec(text);
  if (!start) return [];
  const rest = text.slice(start.index + start[0].length);
  const end = /^==[^=].*$/m.exec(rest); // 次の「== 〜 ==」（同じ深さの見出し）まで
  const section = end ? rest.slice(0, end.index) : rest;

  const entries: BirthEntry[] = [];
  let parentYear: number | null = null;
  for (const raw of section.split("\n")) {
    const m = /^(\*+)\s*(.*)$/.exec(raw);
    if (!m) continue;
    const depth = m[1].length;
    const line = m[2];
    const entry = parseLine(line);
    if (depth === 1) parentYear = entry?.year ?? findYear(line);
    if (!entry) continue;
    // 「* 1990年」の下に「** 人物」と並べる書き方では、親の行の年を使う
    if (entry.year === null && depth > 1) entry.year = parentYear;
    entries.push(entry);
  }
  return entries;
}

function findYear(s: string): number | null {
  // 「[[天文 (元号)|天文]]11年（[[1542年]]）」のように和暦が先に来ても、西暦のリンクを優先する
  const m = /\[\[(紀元前)?(\d{1,4})年\]\]/.exec(s) ?? /(紀元前)?(\d{3,4})年/.exec(s);
  if (!m) return null;
  const year = Number(m[2]);
  return m[1] ? -year : year;
}

function parseLine(line: string): BirthEntry | null {
  // 「年 - 人物、説明」の形。区切りの前が年、後ろが人物
  const sep = /\s[-–—]\s/.exec(line);
  const before = sep ? line.slice(0, sep.index) : "";
  const after = sep ? line.slice(sep.index + sep[0].length) : line;

  const link = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/.exec(after);
  if (!link) return null;
  const title = link[1].trim();
  if (/^(ファイル|画像|File|Image|Category|カテゴリ):/i.test(title) || /^\d+年$/.test(title)) return null;

  let note = after.slice(link.index + link[0].length);
  note = note.replace(/^\s*[、,]\s*/, "");
  // 没年（「（+ 2001年）」など）から後ろは説明に入れない
  const death = /[（(]\s*[+†]/.exec(note);
  if (death) note = note.slice(0, death.index);
  note = cleanWikitext(note);

  return { title, year: sep ? findYear(before) : null, note: note || null };
}

/** リンクや強調、テンプレートなどを取り除いて、ふつうの文にする */
export function cleanWikitext(s: string): string {
  let out = s;
  for (let i = 0; i < 5 && /\{\{[^{}]*\}\}/.test(out); i++) out = out.replace(/\{\{[^{}]*\}\}/g, "");
  return out
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/[、,\s]+$/, "")
    .trim();
}
