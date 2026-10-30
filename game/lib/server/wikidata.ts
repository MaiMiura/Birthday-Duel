// Wikidata から、人物の名前・説明・画像・職業・生年月日と、職業の上位分類を取る。
// 重くて時間切れになりやすいクエリサービス（SPARQL）は使わず、ふつうの API（wbgetentities）を
// 50 件ずつ呼ぶ。
//
// クラウドの共有 IP から使うと、API（api.php）が回数制限（HTTP 429）で断られることがある。
// そのときは、Wikidata 側の 1 件ずつの窓口（Special:ItemByTitle、Special:EntityData）に切り替える。

import type { AncestorMap } from "../classify";
import { allRootIds } from "../categories";
import OCCUPATION_MAP from "../occupation-map.json";
import { JA_API } from "./birthpage";
import { chunk, fetchJson, HttpError, mapLimit, retryAfterMs, USER_AGENT } from "./http";

const WIKIDATA_API = process.env.WIKIDATA_API ?? "https://www.wikidata.org/w/api.php";
const JULIAN_CALENDAR = "http://www.wikidata.org/entity/Q1985786";
const HUMAN = "Q5";
const WIKIDATA_WIKI = process.env.WIKIDATA_WIKI ?? "https://www.wikidata.org/wiki";
const FALLBACK_CONCURRENCY = 3;

/** 1 件ずつの窓口で、混雑などで取れなかった件数（呼び出しごとに数える） */
export interface FetchReport {
  failed: number;
}

/** 1 件ずつ取り、失敗したものは null にして数える（1 人取れなくても手札全体は作る） */
async function eachOrNull<T, R>(items: T[], fn: (item: T) => Promise<R | null>, report?: FetchReport) {
  return mapLimit(items, FALLBACK_CONCURRENCY, async (item) => {
    try {
      return await fn(item);
    } catch {
      if (report) report.failed++;
      return null;
    }
  });
}

// 429 を受けたら、しばらく（5 分）は API を使わず、1 件ずつの窓口を使う
const throttledUntil = new Map<string, number>();
const THROTTLE_MS = 5 * 60_000;
const isThrottled = (api: string) => (throttledUntil.get(api) ?? 0) > Date.now();
function noteThrottle(api: string, e: unknown): boolean {
  if (e instanceof HttpError && e.status === 429) {
    throttledUntil.set(api, Date.now() + THROTTLE_MS);
    return true;
  }
  return false;
}

/** テスト用: 回数制限の記録を消す */
export function resetThrottle() {
  throttledUntil.clear();
}

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
export async function resolveTitles(titles: string[], report?: FetchReport): Promise<Map<string, ResolvedTitle>> {
  const out = new Map<string, ResolvedTitle>();
  const rest: string[] = [];
  for (const part of chunk([...new Set(titles)], 50)) {
    if (isThrottled(JA_API)) {
      rest.push(...part);
      continue;
    }
    try {
      for (const [k, v] of await resolveTitlesBatch(part)) out.set(k, v);
    } catch (e) {
      if (!noteThrottle(JA_API, e)) throw e;
      rest.push(...part);
    }
  }
  if (rest.length) {
    const resolved = await eachOrNull(rest, resolveTitleByItemByTitle, report);
    rest.forEach((t, i) => resolved[i] && out.set(t, resolved[i]!));
  }
  return out;
}

async function resolveTitlesBatch(part: string[]): Promise<Map<string, ResolvedTitle>> {
  const out = new Map<string, ResolvedTitle>();
  const params = new URLSearchParams({
    action: "query",
    prop: "pageprops",
    ppprop: "wikibase_item",
    redirects: "1",
    titles: part.join("|"),
    format: "json",
    formatversion: "2",
  });
  const data = await fetchJson<PagePropsResponse>(`${JA_API}?${params}`, { timeoutMs: 20_000, retries: 0 });
  const normalized = new Map((data.query?.normalized ?? []).map((n) => [n.from, n.to]));
  const redirects = new Map((data.query?.redirects ?? []).map((r) => [r.from, r.to]));
  const pages = new Map((data.query?.pages ?? []).map((p) => [p.title, p]));
  for (const title of part) {
    const norm = normalized.get(title) ?? title;
    const final = redirects.get(norm) ?? norm;
    const qid = pages.get(final)?.pageprops?.wikibase_item;
    if (qid) out.set(title, { qid, title: final });
  }
  return out;
}

/**
 * Wikidata の Special:ItemByTitle で、日本語版の記事名から Q-ID を引く（リダイレクトも解決される）。
 * 項目があれば /wiki/Q123 への 302 が返る。記事名は、あとで項目の jawiki のリンクから取り直す。
 */
async function resolveTitleByItemByTitle(title: string): Promise<ResolvedTitle | null> {
  const url = `${WIKIDATA_WIKI}/Special:ItemByTitle/jawiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    await res.arrayBuffer().catch(() => undefined);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, retryAfterMs(res)));
      continue;
    }
    const qid = /\/(Q\d+)$/.exec(res.headers.get("location") ?? "")?.[1];
    return qid ? { qid, title } : null;
  }
  throw new HttpError(429, "HTTP 429: www.wikidata.org");
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
  sitelinks?: Record<string, { title: string }>;
}

async function getEntities(ids: string[], props: string, report?: FetchReport): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  const rest: string[] = [];
  for (const part of chunk([...new Set(ids)], 50)) {
    if (isThrottled(WIKIDATA_API)) {
      rest.push(...part);
      continue;
    }
    try {
      const params = new URLSearchParams({
        action: "wbgetentities",
        ids: part.join("|"),
        props,
        languages: "ja|en|mul",
        sitefilter: "jawiki",
        format: "json",
      });
      const data = await fetchJson<{ entities?: Record<string, Entity> }>(`${WIKIDATA_API}?${params}`, {
        timeoutMs: 20_000,
        retries: 0,
      });
      for (const e of Object.values(data.entities ?? {})) if (!e.missing) out.set(e.id, e);
    } catch (e) {
      if (!noteThrottle(WIKIDATA_API, e)) throw e;
      rest.push(...part);
    }
  }
  if (rest.length) {
    const entities = await eachOrNull(rest, getEntityData, report);
    rest.forEach((id, i) => entities[i] && out.set(id, entities[i]!));
  }
  return out;
}

/** 項目 1 件の JSON（Special:EntityData、キャッシュから返る）。ない項目は null */
async function getEntityData(id: string): Promise<Entity | null> {
  try {
    const data = await fetchJson<{ entities?: Record<string, Entity> }>(`${WIKIDATA_WIKI}/Special:EntityData/${id}.json`, {
      timeoutMs: 20_000,
      retries: 2,
    });
    // 統合された項目は別の Q-ID で返ってくるので、最初の 1 件を使う
    const entity = Object.values(data.entities ?? {})[0];
    return entity && !entity.missing ? entity : null;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
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
  /** 項目に登録されている日本語版の記事名（リダイレクトではない、今の記事名） */
  jaTitle: string | null;
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
export async function getPersonDetails(qids: string[], report?: FetchReport): Promise<Map<string, PersonDetail>> {
  const entities = await getEntities(qids, "labels|descriptions|claims|sitelinks", report);
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
      jaTitle: e.sitelinks?.jawiki?.title ?? null,
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

type OccupationMap = Record<string, { label: string; roots: string[] }>;
// 職業 → たどり着く根っこ（categories.ts の Q-ID）の表。`npm run build-occupation-map` で作り、
// アプリと一緒に配る。表にある職業は Wikidata に問い合わせずに分類できる。
// categories.ts の根っこを変えたら、表も作り直すこと。
const STATIC_MAP = OCCUPATION_MAP as OccupationMap;

// 表にない職業は、親（P279）を上へたどる。結果は誕生日をまたいで使い回す（サーバーが動いているあいだ）
const occupationParents = new Map<string, string[]>();
const occupationLabels = new Map<string, string>();
const MAX_DEPTH = 8;
const MAX_NODES = 4000;

export interface OccupationInfo {
  ancestors: AncestorMap;
  labels: Map<string, string>;
  /** 混雑などで上位分類をたどりきれなかった職業 */
  unresolved: string[];
}

/**
 * 職業ごとに、分類ルールで使う根っこ（categories.ts の Q-ID）のどれに P279（下位分類）で
 * たどり着けるかと、職業の表示名を取る。表にない職業は、上へ向かって幅優先にたどる（深さと件数に上限あり）。
 */
export async function getOccupationInfo(
  occupationIds: string[],
  { useStaticMap = true }: { useStaticMap?: boolean } = {},
): Promise<OccupationInfo> {
  const roots = new Set(allRootIds());
  const ids = [...new Set(occupationIds)];
  const ancestors: AncestorMap = new Map();
  const labels = new Map<string, string>();
  const walk: string[] = [];
  for (const id of ids) {
    const known = useStaticMap ? STATIC_MAP[id] : undefined;
    if (known) {
      ancestors.set(id, new Set(known.roots));
      labels.set(id, known.label);
    } else {
      walk.push(id);
    }
  }

  let frontier = walk;
  const unresolved = new Set<string>();
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth++) {
    const unknown = frontier.filter((id) => !occupationParents.has(id));
    if (unknown.length) {
      if (occupationParents.size + unknown.length > MAX_NODES) break;
      const entities = await getEntities(unknown, "labels|claims");
      for (const id of unknown) {
        const e = entities.get(id);
        // 取れなかった項目は「親なし」として覚えない（次の問い合わせで取り直す）
        if (!e) {
          unresolved.add(id);
          continue;
        }
        occupationParents.set(id, itemIds(e, "P279"));
        const label = e.labels?.ja?.value ?? e.labels?.en?.value;
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
  for (const id of walk) {
    ancestors.set(id, reach(id, new Set()));
    const label = occupationLabels.get(id);
    if (label) labels.set(id, label);
  }
  return { ancestors, labels, unresolved: [...unresolved] };
}

/** categories.ts の Q-ID の現在のラベル（ルール確認用） */
export async function getLabels(ids: string[]): Promise<Map<string, string>> {
  const entities = await getEntities(ids, "labels");
  return new Map(
    [...entities].map(([id, e]) => [id, `${e.labels?.ja?.value ?? "-"} / ${e.labels?.en?.value ?? "-"}`]),
  );
}
