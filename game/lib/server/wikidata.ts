// Wikidata から、人物の名前・説明・画像・職業・生年月日と、職業の上位分類を取る。
// 重くて時間切れになりやすいクエリサービス（SPARQL）は使わず、ふつうの API（wbgetentities）を
// 50 件ずつ呼ぶ。

import type { AncestorMap } from "../classify";
import { allRootIds } from "../categories";
import { JA_API } from "./birthpage";
import { chunk, fetchJson } from "./http";

const WIKIDATA_API = process.env.WIKIDATA_API ?? "https://www.wikidata.org/w/api.php";
const JULIAN_CALENDAR = "http://www.wikidata.org/entity/Q1985786";
const HUMAN = "Q5";

// ---- 記事名 → Wikidata の Q-ID ----

interface PagePropsResponse {
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; pageprops?: { wikibase_item?: string } }[];
  };
}

export interface ResolvedTitle {
  qid: string;
  /** リダイレクトを解決した後の記事名（閲覧数はこの名前で数える） */
  title: string;
}

/** 日本語版の記事名から、Wikidata の Q-ID とリダイレクト解決後の記事名を引く */
export async function resolveTitles(titles: string[]): Promise<Map<string, ResolvedTitle>> {
  const out = new Map<string, ResolvedTitle>();
  for (const part of chunk([...new Set(titles)], 50)) {
    const params = new URLSearchParams({
      action: "query",
      prop: "pageprops",
      ppprop: "wikibase_item",
      redirects: "1",
      titles: part.join("|"),
      format: "json",
      formatversion: "2",
    });
    const data = await fetchJson<PagePropsResponse>(`${JA_API}?${params}`, { timeoutMs: 20_000, retries: 2 });
    const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.from, n.to]));
    const redirects = new Map((data.query?.redirects ?? []).map((r) => [r.from, r.to]));
    const pages = new Map((data.query?.pages ?? []).map((p) => [p.title, p]));
    for (const title of part) {
      const norm = normalized.get(title) ?? title;
      const final = redirects.get(norm) ?? norm;
      const qid = pages.get(final)?.pageprops?.wikibase_item;
      if (qid) out.set(title, { qid, title: final });
    }
  }
  return out;
}

// ---- Wikidata の項目 ----

interface Snak {
  datavalue?: { value: unknown };
}
interface Claim {
  rank: "preferred" | "normal" | "deprecated";
  mainsnak: Snak;
}
interface Entity {
  id: string;
  missing?: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
}

async function getEntities(ids: string[], props: string): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  for (const part of chunk([...new Set(ids)], 50)) {
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: part.join("|"),
      props,
      languages: "ja|en|mul",
      format: "json",
    });
    const data = await fetchJson<{ entities?: Record<string, Entity> }>(`${WIKIDATA_API}?${params}`, {
      timeoutMs: 20_000,
      retries: 2,
    });
    for (const e of Object.values(data.entities ?? {})) if (!e.missing) out.set(e.id, e);
  }
  return out;
}

/** 最良ランクの文（推奨ランクがあればそれだけ、なければ通常ランク。非推奨は使わない） */
function bestClaims(e: Entity, prop: string): Claim[] {
  const claims = (e.claims?.[prop] ?? []).filter((c) => c.rank !== "deprecated" && c.mainsnak.datavalue);
  const preferred = claims.filter((c) => c.rank === "preferred");
  return preferred.length ? preferred : claims;
}

function itemIds(e: Entity, prop: string): string[] {
  return bestClaims(e, prop)
    .map((c) => (c.mainsnak.datavalue!.value as { id?: string }).id)
    .filter((id): id is string => !!id && /^Q\d+$/.test(id));
}

export interface BirthClaim {
  /** "1987-10-29"（紀元前は "-0100-10-29"） */
  date: string;
  month: number;
  day: number;
  julian: boolean;
}

export interface PersonDetail {
  isHuman: boolean;
  name: string | null;
  nameLang: string;
  nameRoman: string | null;
  description: string | null;
  imageFile: string | null;
  occupations: string[];
  /** 日の精度まで分かる、最良ランクの生年月日 */
  births: BirthClaim[];
}

function toBirthClaim(c: Claim): BirthClaim | null {
  const v = c.mainsnak.datavalue!.value as { time?: string; precision?: number; calendarmodel?: string };
  if (v.precision !== 11 || !v.time) return null;
  const m = /^([+-])(\d+)-(\d{2})-(\d{2})/.exec(v.time);
  if (!m) return null;
  return {
    date: `${m[1] === "-" ? "-" : ""}${m[2].padStart(4, "0")}-${m[3]}-${m[4]}`,
    month: Number(m[3]),
    day: Number(m[4]),
    julian: v.calendarmodel === JULIAN_CALENDAR,
  };
}

/** 名前・日本語の説明・画像ファイル名・職業・生年月日 */
export async function getPersonDetails(qids: string[]): Promise<Map<string, PersonDetail>> {
  const entities = await getEntities(qids, "labels|descriptions|claims");
  const out = new Map<string, PersonDetail>();
  for (const [id, e] of entities) {
    const label = (lang: string) => e.labels?.[lang]?.value;
    const [name, nameLang] = label("ja") ? [label("ja")!, "ja"] : label("en") ? [label("en")!, "en"] : label("mul") ? [label("mul")!, "mul"] : [null, "ja"];
    const en = label("en");
    const image = bestClaims(e, "P18")[0]?.mainsnak.datavalue?.value;
    const p31 = itemIds(e, "P31");
    out.set(id, {
      // 「人間」と登録されているか、種類が登録されていない項目だけを人物として扱う（バンドや動物を除く）
      isHuman: p31.length === 0 || p31.includes(HUMAN),
      name,
      nameLang,
      // 英語ラベルがラテン文字だけなら、ローマ字の名前として使う（"Taylor Swift" など）
      nameRoman: en && /^[\p{Script=Latin}\s.'’-]+$/u.test(en) ? en : null,
      description: e.descriptions?.ja?.value ?? null,
      imageFile: typeof image === "string" ? image : null,
      occupations: itemIds(e, "P106"),
      births: bestClaims(e, "P569").map(toBirthClaim).filter((b): b is BirthClaim => b !== null),
    });
  }
  return out;
}

// ---- 職業の上位分類 ----

// 職業の「親（P279）」と名前は、誕生日をまたいで使い回す（サーバーが動いているあいだ）
const occupationParents = new Map<string, string[]>();
const occupationLabels = new Map<string, string>();
const MAX_DEPTH = 8;
const MAX_NODES = 4000;

/**
 * 職業ごとに、分類ルールで使う根っこ（categories.ts の Q-ID）のどれに P279（下位分類）で
 * たどり着けるかと、職業の表示名を取る。上へ向かって幅優先にたどる（深さと件数に上限あり）。
 */
export async function getOccupationInfo(
  occupationIds: string[],
): Promise<{ ancestors: AncestorMap; labels: Map<string, string> }> {
  const roots = new Set(allRootIds());
  let frontier = [...new Set(occupationIds)];
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const unknown = frontier.filter((id) => !occupationParents.has(id));
    if (unknown.length) {
      if (occupationParents.size + unknown.length > MAX_NODES) break;
      const entities = await getEntities(unknown, "labels|claims");
      for (const id of unknown) {
        const e = entities.get(id);
        occupationParents.set(id, e ? itemIds(e, "P279") : []);
        const label = e?.labels?.ja?.value ?? e?.labels?.en?.value;
        if (label) occupationLabels.set(id, label);
      }
    }
    // 根っこまで来たら、その上はたどらなくてよい
    const next = new Set<string>();
    for (const id of frontier) {
      if (roots.has(id)) continue;
      for (const parent of occupationParents.get(id) ?? []) if (!occupationParents.has(parent)) next.add(parent);
    }
    frontier = [...next];
  }

  const memo = new Map<string, Set<string>>();
  const reach = (id: string, seen: Set<string>): Set<string> => {
    const cached = memo.get(id);
    if (cached) return cached;
    const found = new Set<string>();
    if (roots.has(id)) found.add(id);
    if (!seen.has(id)) {
      seen.add(id);
      for (const parent of occupationParents.get(id) ?? []) reach(parent, seen).forEach((r) => found.add(r));
    }
    memo.set(id, found);
    return found;
  };
  const ancestors: AncestorMap = new Map();
  const labels = new Map<string, string>();
  for (const id of new Set(occupationIds)) {
    ancestors.set(id, reach(id, new Set()));
    const label = occupationLabels.get(id);
    if (label) labels.set(id, label);
  }
  return { ancestors, labels };
}

/** categories.ts の Q-ID の現在のラベル（ルール確認用） */
export async function getLabels(ids: string[]): Promise<Map<string, string>> {
  const entities = await getEntities(ids, "labels");
  return new Map(
    [...entities].map(([id, e]) => [id, `${e.labels?.ja?.value ?? "-"} / ${e.labels?.en?.value ?? "-"}`]),
  );
}
