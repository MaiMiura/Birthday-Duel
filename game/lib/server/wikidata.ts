// Wikidata Query Service から、ある月日生まれの人物と、その職業・名前・説明・画像を取る。

import type { AncestorMap } from "../classify";
import { allRootIds } from "../categories";
import { chunk, fetchJson } from "./http";

export const SPARQL_ENDPOINT =
  process.env.WIKIDATA_SPARQL_ENDPOINT ?? "https://query.wikidata.org/sparql";

const JULIAN_CALENDAR = "http://www.wikidata.org/entity/Q1985786";

/** 1 つの誕生日で扱う最大人数（多すぎるとき、記事のある言語数が多い順に残す） */
export const MAX_PEOPLE = Number(process.env.MAX_PEOPLE_PER_DAY ?? 2000);

interface SparqlResponse {
  results: { bindings: Record<string, { value: string }>[] };
}

async function sparql(query: string, timeoutMs = 60_000) {
  // VALUES が長くなるので POST で送る
  const data = await fetchJson<SparqlResponse>(SPARQL_ENDPOINT, {
    timeoutMs,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query, format: "json" }).toString(),
    },
  });
  return data.results.bindings.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) out[k] = v.value;
    return out;
  });
}

const qid = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);
const values = (ids: string[]) => ids.map((id) => `wd:${id}`).join(" ");

export interface BirthRow {
  id: string;
  birthDate: string;
  julian: boolean;
  jaTitle: string;
  sitelinks: number;
}

/** 何年生まれまでさかのぼって探すか（これより前の人物は対象外） */
const FIRST_YEAR = 1;
/** 1 回の問い合わせに入れる年数 */
const YEARS_PER_QUERY = 300;

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** その月日の、各年の日付リテラル（"1987-10-29T00:00:00Z"^^xsd:dateTime） */
export function birthDateLiterals(month: number, day: number, lastYear: number): string[] {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const out: string[] = [];
  for (let y = FIRST_YEAR; y <= lastYear; y++) {
    if (month === 2 && day === 29 && !isLeapYear(y)) continue;
    out.push(`"${String(y).padStart(4, "0")}-${mm}-${dd}T00:00:00Z"^^xsd:dateTime`);
  }
  return out;
}

/**
 * 日本語版 Wikipedia に記事があり、生年月日（日まで分かるもの）が month/day の人物。
 *
 * 「全員の誕生日を調べて月日で絞る」と重すぎてクエリサービスが時間切れになるので、
 * 「1年10月29日、2年10月29日、…、今年の10月29日」という日付そのもので引く
 * （日付の値には索引があるので速い）。
 *
 * 誕生日の採用方針:
 * - 生年月日の文が複数あるときは「最良ランク」（推奨ランクがあればそれ、なければ通常ランク）だけを見る
 * - そのうち精度が「日」のものだけを使う（年や月までしか分からない日付は、1月1日などに
 *   丸めて記録されているが、それは使わない）
 * - ユリウス暦で記録された日付は、クエリサービスがグレゴリオ暦に換算した値で判定する
 * - 最良ランクの日付が複数あり、そのどれかが一致すれば対象にする
 */
export async function findPeopleBornOn(
  month: number,
  day: number,
  now = new Date(),
): Promise<{ rows: BirthRow[]; total: number }> {
  const rows: Record<string, string>[] = [];
  for (const part of chunk(birthDateLiterals(month, day, now.getUTCFullYear()), YEARS_PER_QUERY)) {
    rows.push(
      ...(await sparql(`
SELECT ?person ?dob ?cal ?jaTitle ?sitelinks WHERE {
  VALUES ?dob { ${part.join(" ")} }
  ?person wdt:P569 ?dob .
  ?person wdt:P31 wd:Q5 ;
          p:P569 ?st ;
          wikibase:sitelinks ?sitelinks .
  ?st a wikibase:BestRank ;
      psv:P569 ?v .
  ?v wikibase:timeValue ?dob ;
     wikibase:timePrecision 11 ;
     wikibase:timeCalendarModel ?cal .
  ?article schema:about ?person ;
           schema:isPartOf <https://ja.wikipedia.org/> ;
           schema:name ?jaTitle .
}`)),
    );
  }
  const byId = new Map<string, BirthRow>();
  for (const r of rows) {
    const id = qid(r.person);
    const row: BirthRow = {
      id,
      birthDate: r.dob.replace(/^\+/, "").slice(0, r.dob.startsWith("-") ? 11 : 10),
      julian: r.cal === JULIAN_CALENDAR,
      jaTitle: r.jaTitle,
      sitelinks: Number(r.sitelinks),
    };
    const prev = byId.get(id);
    if (!prev || row.birthDate < prev.birthDate) byId.set(id, row);
  }
  const all = [...byId.values()].sort((a, b) => b.sitelinks - a.sitelinks || a.id.localeCompare(b.id));
  return { rows: all.slice(0, MAX_PEOPLE), total: all.length };
}

export interface PersonDetail {
  name: string;
  nameLang: string;
  description: string | null;
  imageFile: string | null;
  occupations: string[];
}

/** 名前・日本語の説明・画像ファイル名・職業 */
export async function getPersonDetails(
  ids: string[],
  jaTitles: Map<string, string>,
): Promise<Map<string, PersonDetail>> {
  const details = new Map<string, PersonDetail>();
  for (const part of chunk(ids, 300)) {
    const rows = await sparql(`
SELECT ?person ?ja ?en ?mul ?desc ?image WHERE {
  VALUES ?person { ${values(part)} }
  OPTIONAL { ?person rdfs:label ?ja FILTER(LANG(?ja) = "ja") }
  OPTIONAL { ?person rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?person rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  OPTIONAL { ?person schema:description ?desc FILTER(LANG(?desc) = "ja") }
  OPTIONAL { ?person wdt:P18 ?image }
}`);
    for (const r of rows) {
      const id = qid(r.person);
      if (details.has(id)) continue; // 画像が複数あるときは最初の 1 枚
      // 名前: 日本語ラベル → 日本語版の記事名（括弧の補足を除く）→ 英語 → 多言語共通
      const title = jaTitles.get(id)?.replace(/\s*[（(][^）)]*[）)]\s*$/, "");
      const [name, nameLang] = r.ja
        ? [r.ja, "ja"]
        : title
          ? [title, "ja"]
          : r.en
            ? [r.en, "en"]
            : r.mul
              ? [r.mul, "mul"]
              : [id, "id"];
      details.set(id, {
        name,
        nameLang,
        description: r.desc ?? null,
        imageFile: r.image ? decodeURIComponent(r.image.slice(r.image.lastIndexOf("/") + 1)) : null,
        occupations: [],
      });
    }
    const occRows = await sparql(`
SELECT ?person ?occ WHERE {
  VALUES ?person { ${values(part)} }
  ?person wdt:P106 ?occ .
}`);
    for (const r of occRows) {
      const d = details.get(qid(r.person));
      const occ = qid(r.occ);
      if (d && /^Q\d+$/.test(occ) && !d.occupations.includes(occ)) d.occupations.push(occ);
    }
  }
  return details;
}

/**
 * 職業ごとに、分類ルールで使う根っこ（categories.ts の Q-ID）のどれに P279（下位分類）で
 * たどり着けるかと、職業の表示名を取る。
 */
export async function getOccupationInfo(
  occupationIds: string[],
): Promise<{ ancestors: AncestorMap; labels: Map<string, string> }> {
  const ancestors: AncestorMap = new Map();
  const labels = new Map<string, string>();
  const roots = values(allRootIds());
  for (const part of chunk(occupationIds, 200)) {
    const rows = await sparql(`
SELECT ?occ ?root WHERE {
  VALUES ?occ { ${values(part)} }
  VALUES ?root { ${roots} }
  ?occ wdt:P279* ?root .
}`);
    for (const r of rows) {
      const occ = qid(r.occ);
      if (!ancestors.has(occ)) ancestors.set(occ, new Set());
      ancestors.get(occ)!.add(qid(r.root));
    }
    const labelRows = await sparql(`
SELECT ?occ ?ja ?en WHERE {
  VALUES ?occ { ${values(part)} }
  OPTIONAL { ?occ rdfs:label ?ja FILTER(LANG(?ja) = "ja") }
  OPTIONAL { ?occ rdfs:label ?en FILTER(LANG(?en) = "en") }
}`);
    for (const r of labelRows) {
      const label = r.ja ?? r.en;
      if (label) labels.set(qid(r.occ), label);
    }
  }
  return { ancestors, labels };
}

/** categories.ts の Q-ID の現在のラベル（ルール確認用） */
export async function getLabels(ids: string[]): Promise<Map<string, string>> {
  const rows = await sparql(`
SELECT ?item ?ja ?en WHERE {
  VALUES ?item { ${values(ids)} }
  OPTIONAL { ?item rdfs:label ?ja FILTER(LANG(?ja) = "ja") }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
}`);
  return new Map(rows.map((r) => [qid(r.item), `${r.ja ?? "-"} / ${r.en ?? "-"}`]));
}
