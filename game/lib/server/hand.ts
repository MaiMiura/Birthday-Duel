// 誕生日 1 つ分の手札（実データ）を組み立てる。
// 人物の一覧（Wikipedia の日付ページ）→ 人物の詳細（Wikidata）→ カテゴリー分類（classify）
// → 画像（images）→ スコア（pageviews）の順。

import { birthdayKey } from "../birthday";
import { classify, sensitiveReason } from "../classify";
import { periodKey, scorePeriod } from "../period";
import type { Hand, Person } from "../types";
import { fetchBirthEntries } from "./birthpage";
import { readCache, writeCache } from "./cache";
import { fetchImages } from "./images";
import { fetchViewsMany } from "./pageviews";
import { getOccupationInfo, getPersonDetails, resolveTitles } from "./wikidata";

export function cacheKey(month: number, day: number, now = new Date()) {
  return `${periodKey(scorePeriod(now))}/${birthdayKey({ month, day })}`;
}

export function jaWikipediaUrl(title: string) {
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function formatYear(year: number) {
  return year < 0 ? `-${String(-year).padStart(4, "0")}` : String(year).padStart(4, "0");
}

export async function buildHand(month: number, day: number, now = new Date()): Promise<Hand> {
  const period = scorePeriod(now);
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const timings: Record<string, number> = {};
  let lap = Date.now();
  const mark = (name: string) => {
    timings[name] = Date.now() - lap;
    lap = Date.now();
  };

  const entries = await fetchBirthEntries(month, day);
  mark("page");
  // 混雑で取れなかった人数（その人だけ手札から抜ける）
  const report = { failed: 0 };
  const resolved = await resolveTitles(
    entries.map((e) => e.title),
    report,
  );
  const qids = [...new Set([...resolved.values()].map((r) => r.qid))];
  const details = await getPersonDetails(qids, report);
  mark("people");
  const occupationIds = [...new Set([...details.values()].flatMap((d) => d.occupations))];
  const { ancestors, labels } = occupationIds.length
    ? await getOccupationInfo(occupationIds)
    : { ancestors: new Map(), labels: new Map<string, string>() };
  mark("occupations");
  const images = await fetchImages([...details.values()].flatMap((d) => (d.imageFile ? [d.imageFile] : [])));
  mark("images");

  const seen = new Set<string>();
  const people: Person[] = [];
  for (const entry of entries) {
    const r = resolved.get(entry.title);
    if (!r || seen.has(r.qid)) continue; // Wikidata の項目がない記事や、同じ人の重複は除く
    const d = details.get(r.qid);
    if (!d || !d.isHuman) continue;
    seen.add(r.qid);
    // 閲覧数は今の記事名で数える（Wikidata に登録されている日本語版の記事名を優先）
    const jaTitle = d.jaTitle ?? r.title;

    // 生年月日: Wikidata の日付が同じ月日ならそれを使い、違えば（旧暦・ユリウス暦の違いなど）
    // 一覧に書かれた年とこの月日を使う
    const claim = d.births.find((b) => b.month === month && b.day === day);
    const birthDate = claim ? claim.date : entry.year !== null ? `${formatYear(entry.year)}-${mmdd}` : mmdd;
    const description = d.description ?? entry.note;
    const occupations = d.occupations;
    people.push({
      id: r.qid,
      name: d.name ?? jaTitle.replace(/\s*[（(][^）)]*[）)]\s*$/, ""),
      nameLang: d.name ? d.nameLang : "ja",
      nameRoman: d.nameRoman,
      description,
      birthDate,
      julian: claim?.julian ?? false,
      occupations: occupations.map((id) => ({ id, label: labels.get(id) ?? id })),
      categories: classify(occupations, ancestors),
      sensitive: sensitiveReason(occupations, description, ancestors),
      jaTitle,
      jaUrl: jaWikipediaUrl(jaTitle),
      wikidataUrl: `https://www.wikidata.org/wiki/${r.qid}`,
      image: d.imageFile ? (images.get(d.imageFile) ?? null) : null,
      score: { status: "not-fetched" },
    });
  }
  // 並び順は生まれ年の新しい順（知名度順に並べると、公開前にスコアの大小が分かってしまうため）
  people.sort((a, b) => b.birthDate.localeCompare(a.birthDate, "en", { numeric: true }));

  // 閲覧数は、ここでは取らない（「このカードで勝負」を押したときに、その 1 人分だけ取る）。
  // 勝負に使えるのはカテゴリーに入る人だけなので、その人たちを「未取得」にしておく
  for (const p of people) if (p.categories.length > 0 && p.jaTitle) p.score = { status: "pending" };

  return {
    mode: "live",
    month,
    day,
    period,
    fetchedAt: now.toISOString(),
    people,
    truncated: report.failed > 0,
    totalFound: people.length + report.failed,
    timings,
  };
}

// 同じ誕生日の取得が同時に走らないようにする（友達が同時に開いても 1 回だけ取る）
const inflight = new Map<string, Promise<Hand>>();

export async function getHand(month: number, day: number, now = new Date()): Promise<Hand> {
  const key = cacheKey(month, day, now);
  const cached = await readCache(key);
  if (cached) return cached;
  let job = inflight.get(key);
  if (!job) {
    job = buildHand(month, day, now)
      .then(async (hand) => {
        // 一部の人を取れなかった手札は保存しない（次に開いたときに、もう一度全員を取りに行く）
        if (!hand.truncated) await writeCache(key, hand);
        return hand;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  return job;
}

/** スコアの取得に失敗したカードだけ取り直す */
export async function retryFailedScores(month: number, day: number, now = new Date()): Promise<Hand> {
  const key = cacheKey(month, day, now);
  const hand = await getHand(month, day, now);
  const failed = hand.people.filter((p) => p.score.status === "failed" && p.jaTitle);
  if (failed.length === 0) return hand;
  const scores = await fetchViewsMany(
    failed.map((p) => p.jaTitle!),
    hand.period,
  );
  const byId = new Map(failed.map((p, i) => [p.id, scores[i]]));
  const updated: Hand = {
    ...hand,
    people: hand.people.map((p) => (byId.has(p.id) ? { ...p, score: byId.get(p.id)! } : p)),
  };
  await writeCache(key, updated);
  return updated;
}
