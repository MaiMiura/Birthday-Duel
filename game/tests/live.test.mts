// 実データ取得の処理を、外部 API の応答をまねたモックで確認する（ネットワークは使わない）。

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.HAND_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), "bduel-test-"));

const { fetchViews } = await import("../lib/server/pageviews");
const { toPersonImage } = await import("../lib/server/images");
const { getHand, retryFailedScores } = await import("../lib/server/hand");
const { clearMemoryCache } = await import("../lib/server/cache");

type Handler = (url: URL, body: string) => Response | Promise<Response>;
const realFetch = globalThis.fetch;
let calls: string[] = [];

function mockFetch(handler: Handler) {
  calls = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push(`${url.host}${url.pathname}`);
    return handler(url, body);
  }) as typeof fetch;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const bindings = (rows: Record<string, string>[]) =>
  json({
    results: {
      bindings: rows.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { type: "literal", value: v }])),
      ),
    },
  });
const E = (id: string) => `http://www.wikidata.org/entity/${id}`;
const period = { start: "2025-10", end: "2026-09" };
const NOW = new Date("2026-10-29T03:00:00Z");

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("閲覧数", () => {
  it("人間の閲覧（user）の月別を合計し、期間外の月は数えない", async () => {
    mockFetch((url) => {
      assert.match(url.pathname, /\/all-access\/user\/.+\/monthly\/20251001\/20260930$/);
      return json({
        items: [
          { timestamp: "2025093000", views: 999 }, // 期間外
          { timestamp: "2025100100", views: 100 },
          { timestamp: "2026090100", views: 23 },
        ],
      });
    });
    assert.deepEqual(await fetchViews("トーヴ・ロー", period), { status: "ok", views: 123 });
  });
  it("記事名の空白は _ にして URL エンコードする", async () => {
    mockFetch(() => json({ items: [] }));
    await fetchViews("AC/DC 2 (band)", period);
    assert.match(calls[0], /AC%2FDC_2_\(band\)\/monthly/);
  });
  it("404（閲覧記録なし）は 0 回、それ以外のエラーは失敗として区別する", async () => {
    mockFetch(() => json({ type: "not-found" }, 404));
    assert.deepEqual(await fetchViews("だれか", period), { status: "ok", views: 0 });
    mockFetch(() => json({}, 500));
    const failed = await fetchViews("だれか", period);
    assert.equal(failed.status, "failed");
  });
});

describe("画像のライセンス", () => {
  const info = (license: string, artist: string) => [
    {
      thumburl: "https://upload.wikimedia.org/x.jpg",
      descriptionurl: "https://commons.wikimedia.org/wiki/File:X.jpg",
      extmetadata: {
        LicenseShortName: { value: license },
        Artist: { value: artist },
        LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0" },
      },
    },
  ];
  it("CC BY-SA は作者が分かれば使う", () => {
    const img = toPersonImage(info("CC BY-SA 4.0", '<a href="//x">山田 太郎</a>'));
    assert.equal(img?.artist, "山田 太郎");
    assert.equal(img?.license, "CC BY-SA 4.0");
  });
  it("作者が分からない CC BY は使わない", () => {
    assert.equal(toPersonImage(info("CC BY 3.0", "")), null);
  });
  it("パブリックドメインは作者不明でも使う", () => {
    assert.ok(toPersonImage(info("Public domain", "")));
  });
  it("確認できないライセンス（フェアユースなど）は使わない", () => {
    assert.equal(toPersonImage(info("Fair use", "someone")), null);
    assert.equal(toPersonImage(info("", "someone")), null);
  });
});

describe("手札の組み立て（モック）", () => {
  let pageviewsFail = true;
  let sparqlCalls = 0;
  let dayQueries: string[] = [];

  beforeEach(() => {
    clearMemoryCache();
    pageviewsFail = true;
    sparqlCalls = 0;
    dayQueries = [];
    mockFetch(async (url, body) => {
      if (url.host === "query.wikidata.org") {
        sparqlCalls++;
        const q = new URLSearchParams(body).get("query") ?? "";
        if (q.includes("wikibase:BestRank")) {
          dayQueries.push(q);
          return bindings([
            { person: E("Q1"), dob: "1990-02-29T00:00:00Z", cal: E("Q1985331"), jaTitle: "歌う 人", sitelinks: "30" },
            { person: E("Q1"), dob: "1992-02-29T00:00:00Z", cal: E("Q1985331"), jaTitle: "歌う 人", sitelinks: "30" },
            { person: E("Q2"), dob: "1600-02-29T00:00:00Z", cal: E("Q1985786"), jaTitle: "昔の 王", sitelinks: "10" },
            { person: E("Q3"), dob: "1950-02-29T00:00:00Z", cal: E("Q1985331"), jaTitle: "作家 (小説家)", sitelinks: "5" },
          ]);
        }
        if (q.includes("schema:description")) {
          return bindings([
            { person: E("Q1"), ja: "歌う人", desc: "日本の歌手", image: "http://commons.wikimedia.org/wiki/Special:FilePath/Singer%20A.jpg" },
            { person: E("Q2"), en: "Old King" },
            { person: E("Q3") },
          ]);
        }
        if (q.includes("wdt:P106")) {
          return bindings([
            { person: E("Q1"), occ: E("Q177220") },
            { person: E("Q2"), occ: E("Q116") },
            { person: E("Q3"), occ: E("Q36180") },
          ]);
        }
        if (q.includes("wdt:P279*")) {
          return bindings([
            { occ: E("Q177220"), root: E("Q177220") },
            { occ: E("Q177220"), root: E("Q639669") },
            { occ: E("Q116"), root: E("Q116") },
          ]);
        }
        return bindings([{ occ: E("Q177220"), ja: "歌手" }, { occ: E("Q116"), ja: "君主" }]);
      }
      if (url.host === "commons.wikimedia.org") {
        return json({
          query: {
            pages: [
              {
                title: "File:Singer A.jpg",
                imageinfo: [
                  {
                    thumburl: "https://upload.wikimedia.org/thumb.jpg",
                    descriptionurl: "https://commons.wikimedia.org/wiki/File:Singer_A.jpg",
                    extmetadata: { LicenseShortName: { value: "CC BY 4.0" }, Artist: { value: "Photographer" } },
                  },
                ],
              },
            ],
          },
        });
      }
      if (url.host === "wikimedia.org") {
        if (url.pathname.includes(encodeURIComponent("昔の_王")) && pageviewsFail) return json({}, 503);
        return json({ items: [{ timestamp: "2026010100", views: 42 }] });
      }
      throw new Error(`unexpected ${url}`);
    });
  });

  it("人物・分類・画像・スコアがそろい、取得失敗は再試行で埋まる", async () => {
    const hand = await getHand(2, 29, NOW);
    assert.equal(hand.mode, "live");
    assert.match(dayQueries[0], /MONTH\(\?dob\) = 2 && DAY\(\?dob\) = 29/);
    assert.deepEqual(hand.period, { start: "2025-10", end: "2026-09" });
    assert.equal(hand.people.length, 3); // Q1 の誕生日 2 つは 1 人にまとめる

    const [singer, king, writer] = hand.people;
    assert.equal(singer.birthDate, "1990-02-29");
    assert.deepEqual(singer.categories, ["music"]);
    assert.equal(singer.image?.artist, "Photographer");
    assert.deepEqual(singer.score, { status: "ok", views: 42 });

    assert.equal(king.name, "昔の 王"); // 日本語ラベルがなければ記事名
    assert.equal(king.julian, true);
    assert.equal(king.image, null);
    assert.equal(king.score.status, "failed");
    assert.equal(king.description, null); // 説明は作らない

    assert.equal(writer.name, "作家"); // 記事名の括弧は除く
    assert.deepEqual(writer.categories, []);
    assert.equal(writer.score.status, "not-fetched");

    // 2 回目はキャッシュから（Wikidata に問い合わせない）
    const before = sparqlCalls;
    await getHand(2, 29, NOW);
    assert.equal(sparqlCalls, before);

    pageviewsFail = false;
    const retried = await retryFailedScores(2, 29, NOW);
    assert.deepEqual(retried.people[1].score, { status: "ok", views: 42 });
  });

  it("同時に開いても取得は 1 回", async () => {
    const [a, b] = await Promise.all([getHand(3, 1, NOW), getHand(3, 1, NOW)]);
    assert.equal(a, b);
    assert.equal(dayQueries.length, 1);
  });
});
