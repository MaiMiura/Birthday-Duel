// 誕生日 1 つ分の手札（実データ）を組み立てる。
// 人物取得（wikidata）→ カテゴリー分類（classify）→ 画像（images）→ スコア（pageviews）の順。

import { birthdayKey } from "../birthday";
import { classify, sensitiveReason } from "../classify";
import { periodKey, scorePeriod } from "../period";
import type { Hand, Person } from "../types";
import { readCache, writeCache } from "./cache";
import { fetchImages } from "./images";
import { fetchViewsMany } from "./pageviews";
import { findPeopleBornOn, getOccupationInfo, getPersonDetails } from "./wikidata";

export function cacheKey(month: number, day: number, now = new Date()) {
  return `${periodKey(scorePeriod(now))}/${birthdayKey({ month, day })}`;
}

export function jaWikipediaUrl(title: string) {
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export async function buildHand(month: number, day: number, now = new Date()): Promise<Hand> {
  const period = scorePeriod(now);
  const { rows, total } = await findPeopleBornOn(month, day, now);
  const ids = rows.map((r) => r.id);
  const details = await getPersonDetails(ids, new Map(rows.map((r) => [r.id, r.jaTitle])));
  const occupationIds = [...new Set([...details.values()].flatMap((d) => d.occupations))];
  const { ancestors, labels } = occupationIds.length
    ? await getOccupationInfo(occupationIds)
    : { ancestors: new Map(), labels: new Map<string, string>() };
  const images = await fetchImages(
    [...details.values()].flatMap((d) => (d.imageFile ? [d.imageFile] : [])),
  );

  const people: Person[] = rows.map((r) => {
    const d = details.get(r.id);
    const occupations = d?.occupations ?? [];
    const description = d?.description ?? null;
    const categories = classify(occupations, ancestors);
    return {
      id: r.id,
      name: d?.name ?? r.jaTitle,
      nameLang: d?.nameLang ?? "ja",
      description,
      birthDate: r.birthDate,
      julian: r.julian,
      occupations: occupations.map((id) => ({ id, label: labels.get(id) ?? id })),
      categories,
      sensitive: sensitiveReason(occupations, description, ancestors),
      jaTitle: r.jaTitle,
      jaUrl: jaWikipediaUrl(r.jaTitle),
      wikidataUrl: `https://www.wikidata.org/wiki/${r.id}`,
      image: d?.imageFile ? (images.get(d.imageFile) ?? null) : null,
      score: { status: "not-fetched" },
    };
  });

  // 勝負に使えるのはカテゴリーに入る人だけなので、その人たちのスコアを取る
  const scored = people.filter((p) => p.categories.length > 0 && p.jaTitle);
  const scores = await fetchViewsMany(
    scored.map((p) => p.jaTitle!),
    period,
  );
  scored.forEach((p, i) => (p.score = scores[i]));

  return {
    mode: "live",
    month,
    day,
    period,
    fetchedAt: now.toISOString(),
    people,
    truncated: total > rows.length,
    totalFound: total,
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
        await writeCache(key, hand);
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
