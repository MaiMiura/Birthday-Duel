// 人物画像（Wikidata の P18 → Wikimedia Commons）と、そのライセンス・クレジット。
// ライセンスと作者が確認できた画像だけを使い、それ以外は使わない（画面は代替ビジュアルになる）。

import type { PersonImage } from "../types";
import { chunk, fetchJson } from "./http";

const COMMONS_API = process.env.COMMONS_API ?? "https://commons.wikimedia.org/w/api.php";

interface ExtValue {
  value?: string;
}
interface CommonsResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    pages?: {
      title: string;
      missing?: boolean;
      imageinfo?: {
        thumburl?: string;
        url?: string;
        descriptionurl?: string;
        extmetadata?: Record<string, ExtValue | undefined>;
      }[];
    }[];
  };
}

/** 再利用が認められていて、条件（クレジット表記）を守れるライセンスだけ許可する */
const ALLOWED_LICENSE = /^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?(\s+\d(\.\d)?)?(\s|$))/i;
const NO_CREDIT_NEEDED = /^(public domain|pd\b|pd-|cc0)/i;

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Commons の extmetadata から PersonImage を作る。条件を満たさなければ null。 */
export function toPersonImage(info: NonNullable<NonNullable<CommonsResponse["query"]>["pages"]>[number]["imageinfo"]): PersonImage | null {
  const ii = info?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value ?? "");
  const artist = stripHtml(meta.Artist?.value ?? "");
  const url = ii.thumburl ?? ii.url;
  if (!url || !ii.descriptionurl || !license || !ALLOWED_LICENSE.test(license)) return null;
  const creditNeeded = !NO_CREDIT_NEEDED.test(license);
  if (creditNeeded && !artist) return null; // 作者が分からないとクレジットを表示できない
  return {
    url,
    pageUrl: ii.descriptionurl,
    artist: artist || "不明（パブリックドメイン）",
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
  };
}

/** ファイル名 → 使える画像（使えないものは結果に入らない） */
export async function fetchImages(files: string[]): Promise<Map<string, PersonImage>> {
  const result = new Map<string, PersonImage>();
  for (const part of chunk([...new Set(files)], 50)) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: "480",
      iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist",
      titles: part.map((f) => `File:${f}`).join("|"),
    });
    let data: CommonsResponse;
    try {
      data = await fetchJson<CommonsResponse>(`${COMMONS_API}?${params}`, { timeoutMs: 10_000, retries: 0 });
    } catch {
      continue; // 写真はなくてもカードは成り立つので、断られたら待たずに代替ビジュアルにする
    }
    const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.to, n.from]));
    for (const page of data.query?.pages ?? []) {
      if (page.missing) continue;
      const image = toPersonImage(page.imageinfo);
      if (!image) continue;
      const requested = (normalized.get(page.title) ?? page.title).replace(/^File:/, "");
      result.set(requested, image);
      result.set(page.title.replace(/^File:/, ""), image);
    }
  }
  return result;
}
