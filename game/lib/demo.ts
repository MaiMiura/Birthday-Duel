// デモモード用のデータ。人物はすべて架空で、閲覧数は「デモ値」。
// 実データと同じ Hand の形にして、画面とカード操作を共通にしている。
// 確認したいケース（複数カテゴリー、画像あり/なし、スコア 0、取得失敗、日本語版なし、
// カテゴリーなし、子ども向けフィルター、ユリウス暦、2 月 29 日、候補のいないカテゴリー）を含める。

import { scorePeriod } from "./period";
import type { CategoryId, Hand, Person, Score } from "./types";

interface DemoPerson {
  id: string;
  name: string;
  year: string;
  description: string | null;
  categories: CategoryId[];
  occupations: string[];
  score: Score;
  image?: "singer" | "athlete";
  julian?: boolean;
  noArticle?: boolean;
  sensitive?: string;
}

const views = (n: number): Score => ({ status: "ok", views: n, demo: true });

const DEMO: Record<string, DemoPerson[]> = {
  "10-29": [
    { id: "D1029-1", name: "星野 そら", year: "1990", description: "歌もお芝居もこなす架空のスター（デモ）", categories: ["entertainment", "music"], occupations: ["俳優", "歌手"], score: views(1_234_567) },
    { id: "D1029-2", name: "青井 かなで", year: "1987", description: "架空のシンガーソングライター（デモ）", categories: ["music"], occupations: ["歌手", "作曲家"], score: views(845_210), image: "singer" },
    { id: "D1029-3", name: "早瀬 ゆうき", year: "1995", description: "架空のサッカー選手（デモ）", categories: ["sports"], occupations: ["サッカー選手"], score: views(2_310_005), image: "athlete" },
    { id: "D1029-4", name: "光 はかせ", year: "1879", description: "架空の発明家（デモ）", categories: ["knowledge"], occupations: ["発明家", "物理学者"], score: views(98_765) },
    { id: "D1029-5", name: "稲穂 まさる", year: "1542", description: "架空の戦国武将。ユリウス暦の日付の例（デモ）", categories: ["history"], occupations: ["武士", "政治家"], score: views(456_789), julian: true },
    { id: "D1029-6", name: "雲野 まり", year: "2001", description: "架空の新人声優。閲覧数 0 の例（デモ）", categories: ["entertainment"], occupations: ["声優"], score: views(0) },
    { id: "D1029-7", name: "風間 つよし", year: "1984", description: "架空のマラソン選手。スコア取得失敗の例（デモ）", categories: ["sports"], occupations: ["陸上競技選手"], score: { status: "failed", reason: "デモ: 閲覧数 API がタイムアウトした想定" } },
    { id: "D1029-8", name: "Emma Nordlund", year: "1993", description: "架空の海外歌手。日本語版の記事がない例（デモ）", categories: ["music"], occupations: ["歌手"], score: { status: "no-article" }, noArticle: true },
    { id: "D1029-9", name: "筆野 ことは", year: "1950", description: "架空の小説家。どのカテゴリーにも入らない例（デモ）", categories: [], occupations: ["小説家"], score: { status: "not-fetched" } },
    { id: "D1029-10", name: "影山 くろう", year: "1970", description: "子ども向けフィルターの確認用の架空の人物（デモ）", categories: ["history"], occupations: ["犯罪者"], score: views(3_000_000), sensitive: "犯罪者として記録" },
    { id: "D1029-11", name: "名もなき 画家", year: "1910", description: null, categories: ["knowledge"], occupations: ["思想家"], score: views(12_345) },
  ],
  "02-29": [
    { id: "D0229-1", name: "閏 はるか", year: "1996", description: "4 年に 1 度の誕生日の架空のアイドル（デモ）", categories: ["entertainment", "music"], occupations: ["タレント", "歌手"], score: views(678_901) },
    { id: "D0229-2", name: "跳馬 たける", year: "1988", description: "架空の体操選手（デモ）", categories: ["sports"], occupations: ["体操選手"], score: views(234_567), image: "athlete" },
    { id: "D0229-3", name: "閏年 ただし", year: "1820", description: "架空の明治の政治家（デモ）", categories: ["history"], occupations: ["政治家"], score: views(54_321) },
  ],
  "01-01": [
    { id: "D0101-1", name: "初日 のぼる", year: "1975", description: "架空のお笑い芸人（デモ）", categories: ["entertainment"], occupations: ["お笑い芸人"], score: views(1_500_000) },
    { id: "D0101-2", name: "元旦 ひびき", year: "1968", description: "架空の指揮者（デモ）", categories: ["music"], occupations: ["指揮者"], score: views(87_654), image: "singer" },
    { id: "D0101-3", name: "門松 けんた", year: "1999", description: "架空の野球選手（デモ）", categories: ["sports"], occupations: ["野球選手"], score: views(990_000) },
    { id: "D0101-4", name: "鏡 もち子", year: "1890", description: "架空の数学者（デモ）", categories: ["knowledge"], occupations: ["数学者"], score: views(76_543) },
    { id: "D0101-5", name: "年神 さだめ", year: "1600", description: "架空の歴史上の指導者（デモ）", categories: ["history"], occupations: ["君主"], score: views(990_000) },
  ],
};

export const DEMO_BIRTHDAYS = Object.keys(DEMO).map((k) => {
  const [month, day] = k.split("-").map(Number);
  return { month, day };
});

export function getDemoHand(month: number, day: number, now = new Date()): Hand | null {
  const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const list = DEMO[key];
  if (!list) return null;
  const people: Person[] = list.map((d) => ({
    id: d.id,
    name: d.name,
    nameLang: "ja",
    description: d.description,
    birthDate: `${d.year}-${key}`,
    julian: d.julian ?? false,
    occupations: d.occupations.map((label, i) => ({ id: `${d.id}-occ${i}`, label })),
    categories: d.categories,
    sensitive: d.sensitive ?? null,
    jaTitle: d.noArticle ? null : d.name,
    jaUrl: null,
    wikidataUrl: "",
    image: d.image
      ? {
          url: `/demo/${d.image}.svg`,
          pageUrl: `/demo/${d.image}.svg`,
          artist: "デモ用イラスト",
          license: "デモ用（このアプリのために作成）",
          licenseUrl: null,
        }
      : null,
    score: d.score,
  }));
  return {
    mode: "demo",
    month,
    day,
    period: scorePeriod(now),
    fetchedAt: now.toISOString(),
    people,
    truncated: false,
    totalFound: people.length,
  };
}
