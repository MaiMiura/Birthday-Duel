// 日本語版 Wikipedia の記事の冒頭（「〇〇は、日本の歌手。…」）。公開画面で「何をした人か」を見せるのに使う。
// 本文は Wikipedia のもの（CC BY-SA 4.0）で、画面には出典とライセンスを添える。

import { fetchJson, fetchText } from "./http";

const JA_REST = process.env.JA_WIKIPEDIA_REST ?? "https://ja.wikipedia.org/api/rest_v1";
const JA_INDEX = process.env.JA_WIKIPEDIA_INDEX ?? "https://ja.wikipedia.org/w/index.php";
const MAX_LENGTH = 120;

// 同じ記事の冒頭は、サーバーが動いているあいだ使い回す
const cache = new Map<string, string | null>();

/** 記事の冒頭の数文。長いときは文の切れ目で短くする。取れなければ null（画面は肩書きだけになる） */
export async function fetchSummary(jaTitle: string): Promise<string | null> {
  if (cache.has(jaTitle)) return cache.get(jaTitle)!;
  const path = encodeURIComponent(jaTitle.replace(/ /g, "_"));
  let text: string | null = null;
  try {
    const data = await fetchJson<{ extract?: string }>(`${JA_REST}/page/summary/${path}`, { timeoutMs: 6_000, retries: 0 });
    text = data.extract ?? "";
  } catch {
    // 要約 API が混んでいる（429）ときは、キャッシュの効く記事本文（wikitext）から冒頭を抜き出す
    try {
      text = leadFromWikitext(await fetchText(`${JA_INDEX}?title=${path}&action=raw`, { timeoutMs: 6_000, retries: 0 }));
    } catch {
      return null; // 取れなくても勝負はできる（次に押したときにまた取りに行く）
    }
  }
  const summary = shorten(dropSubject(text.replace(/\s+/g, " ").trim())) || null;
  cache.set(jaTitle, summary);
  return summary;
}

/** wikitext から最初の本文の段落を取り出して、記号を除いた文にする */
export function leadFromWikitext(wikitext: string): string {
  let s = wikitext.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  // 入れ子のテンプレート（基礎情報など）と表を、内側から消す
  for (let i = 0; i < 10 && /\{\{[^{}]*\}\}/.test(s); i++) s = s.replace(/\{\{[^{}]*\}\}/g, "");
  s = s.replace(/\{\|[\s\S]*?\|\}/g, "");
  // 画像などは中にリンクを含むので、外側の [[ ]] ごと消す
  for (let i = 0; i < 3; i++) {
    s = s.replace(/\[\[(?:ファイル|画像|File|Image|Category|カテゴリ):(?:[^[\]]|\[\[[^\]]*\]\])*\]\]/gi, "");
  }
  const paragraph = s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(=|\*|#|:|;|\||!|__)/.test(p) && /。/.test(p));
  if (!paragraph) return "";
  return paragraph
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/（\s*[、,]?\s*）/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 「手越 祐也（てごし ゆうや、…）は、日本のタレント…」の「…は、」までを省く（名前は画面の見出しにある） */
export function dropSubject(text: string): string {
  const m = text.match(/^[^。]{1,80}?(?:）|\)|\s)は、?\s*/);
  return m && m[0].length < text.length ? text.slice(m[0].length) : text;
}

/** MAX_LENGTH 文字までに、なるべく「。」で区切って短くする */
export function shorten(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  const cut = text.slice(0, MAX_LENGTH);
  const end = cut.lastIndexOf("。");
  return end >= 40 ? cut.slice(0, end + 1) : `${cut.slice(0, MAX_LENGTH - 1)}…`;
}
