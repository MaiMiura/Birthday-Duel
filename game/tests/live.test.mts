// 実データ取得の処理を、外部 API の応答をまねたモックで確認する（ネットワークは使わない）。

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.HAND_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), "bduel-test-"));

const { fetchViews } = await import("../lib/server/pageviews");
const { toPersonImage } = await import("../lib/server/images");
const { getHand } = await import("../lib/server/hand");
const { clearMemoryCache } = await import("../lib/server/cache");
const { parseBirths } = await import("../lib/server/birthpage");
const { resetThrottle } = await import("../lib/server/wikidata");

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

describe("途中で切れた応答・時間切れ", () => {
  it("JSON が壊れていたら、分かるエラーにする（1 回は再試行する）", async () => {
    const { fetchJson } = await import("../lib/server/http");
    let count = 0;
    mockFetch(() => {
      count++;
      return new Response('{"query":{"pages":[{"title":', { status: 200 });
    });
    await assert.rejects(fetchJson("https://ja.wikipedia.org/w/api.php", { timeoutMs: 1000 }), /途中で切れました/);
    assert.equal(count, 2);
  });
  it("本文を読んでいる途中の時間切れも、時間切れとして扱う", async () => {
    const { fetchJson, TimeoutError } = await import("../lib/server/http");
    mockFetch(() => {
      const body = new ReadableStream({
        pull(controller) {
          controller.error(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
        },
      });
      return new Response(body, { status: 200 });
    });
    await assert.rejects(fetchJson("https://ja.wikipedia.org/w/api.php", { timeoutMs: 1000, retries: 0 }), TimeoutError);
  });
});

// 日本語版 Wikipedia の日付ページの書き方をまねたもの
const BIRTH_PAGE = [
  "'''2月29日'''（にがつにじゅうくにち）は、[[グレゴリオ暦]]で年始から60日目にあたる。",
  "",
  "== できごと ==",
  "* [[1940年]] - [[できごとの記事]]、何かが起きる",
  "",
  "== 誕生日 ==",
  "=== 人物 ===",
  "<!-- 生年順に並べる -->",
  "* [[紀元前100年]] - [[古代の 人]]、哲学者（+ [[紀元前40年]]）",
  "* [[天文 (元号)|天文]]11年（[[1600年]]） - [[昔の 王]]、[[君主]]",
  "* [[1950年]] - [[作家 (小説家)|作家]]、[[小説家]]<ref>{{Cite web|title=出典}}</ref>",
  "* [[1990年]]",
  "** [[歌う 人]]、'''[[歌手]]'''（[[架空のバンド]]）",
  "** [[架空のバンド]]、ロックバンド",
  "* [[1992年]] - [[歌う人 (別名)|歌う人]]、歌手",
  "* 生年不詳 - [[ファイル:Example.jpg]] [[年のない 人]]、俳優",
  "* [[2001年]] - 赤リンクの人、俳優",
  "* [[2002年]] - [[記事のない 人]]、モデル（† [[2020年]]）",
  "",
  "== 誕生日（フィクション） ==",
  "* [[2000年]] - [[架空の キャラクター]]、主人公",
  "",
  "== 忌日 ==",
  "* [[1999年]] - [[亡くなった 人]]",
].join("\n");

describe("日付ページの誕生日の読み取り", () => {
  const births = parseBirths(BIRTH_PAGE);
  const byTitle = (t: string) => births.find((b) => b.title === t);

  it("「誕生日」の節だけを読む（できごと・フィクション・忌日は入れない）", () => {
    assert.ok(!byTitle("できごとの記事"));
    assert.ok(!byTitle("架空の キャラクター"));
    assert.ok(!byTitle("亡くなった 人"));
  });
  it("年・人物・説明を読み、没年や出典は説明に入れない", () => {
    assert.deepEqual(byTitle("古代の 人"), { title: "古代の 人", year: -100, note: "哲学者" });
    assert.deepEqual(byTitle("作家 (小説家)"), { title: "作家 (小説家)", year: 1950, note: "小説家" });
    assert.deepEqual(byTitle("記事のない 人"), { title: "記事のない 人", year: 2002, note: "モデル" });
  });
  it("和暦が先にあっても、西暦のリンクを年として使う", () => {
    assert.equal(byTitle("昔の 王")?.year, 1600);
  });
  it("入れ子の行は親の行の年を使う", () => {
    assert.deepEqual(byTitle("歌う 人"), { title: "歌う 人", year: 1990, note: "歌手（架空のバンド）" });
    assert.equal(byTitle("架空のバンド")?.year, 1990);
  });
  it("年が分からない行・リンクのない人・ファイルは扱いを分ける", () => {
    assert.equal(byTitle("年のない 人")?.year ?? null, null);
    assert.ok(!births.some((b) => b.title.startsWith("ファイル:")));
    assert.ok(!births.some((b) => b.note?.includes("赤リンク")));
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
  let pageReads = 0;

  // Wikidata の項目（人物と職業）
  const time = (t: string, julian = false) => ({
    rank: "normal",
    mainsnak: {
      datavalue: {
        value: {
          time: t,
          precision: 11,
          calendarmodel: `http://www.wikidata.org/entity/${julian ? "Q1985786" : "Q1985727"}`,
        },
      },
    },
  });
  const item = (id: string, rank = "normal") => ({ rank, mainsnak: { datavalue: { value: { id } } } });
  const ENTITIES: Record<string, object> = {
    Q1: {
      id: "Q1",
      labels: { ja: { value: "歌う人" } },
      descriptions: { ja: { value: "日本の歌手" } },
      claims: {
        P31: [item("Q5")],
        P106: [item("Q177220")],
        P18: [{ rank: "normal", mainsnak: { datavalue: { value: "Singer A.jpg" } } }],
        P569: [time("+1990-02-29T00:00:00Z")],
      },
    },
    Q2: {
      id: "Q2",
      labels: { en: { value: "Old King" } },
      claims: { P31: [item("Q5")], P106: [item("Q116")], P569: [time("+1600-02-19T00:00:00Z", true)] },
    },
    Q3: {
      id: "Q3",
      labels: { ja: { value: "作家" }, en: { value: "Sakka" } },
      claims: { P31: [item("Q5")], P106: [item("Q36180")], P569: [time("+1950-02-29T00:00:00Z")] },
    },
    Q4: { id: "Q4", labels: { ja: { value: "架空のバンド" } }, claims: { P31: [item("Q215380")] } },
    Q55: { id: "Q55", labels: { ja: { value: "古代の人" } }, claims: { P31: [item("Q5")], P106: [item("Q4964182")] } },
    // 職業（P279 で上位分類へ）
    Q177220: { id: "Q177220", labels: { ja: { value: "歌手" } }, claims: { P279: [item("Q639669")] } },
    Q639669: { id: "Q639669", labels: { ja: { value: "音楽家" } }, claims: { P279: [item("Q483501")] } },
    Q483501: { id: "Q483501", labels: { ja: { value: "芸術家" } }, claims: {} },
    Q116: { id: "Q116", labels: { ja: { value: "君主" } }, claims: {} },
    Q36180: { id: "Q36180", labels: { ja: { value: "作家" } }, claims: { P279: [item("Q482980")] } },
    Q482980: { id: "Q482980", labels: { ja: { value: "著述家" } }, claims: {} },
    Q4964182: { id: "Q4964182", labels: { ja: { value: "哲学者" } }, claims: {} },
  };
  const PAGEPROPS: Record<string, string> = {
    "歌う 人": "Q1",
    "昔の 王": "Q2",
    "作家 (小説家)": "Q3",
    "架空のバンド": "Q4",
    "古代の 人": "Q55",
  };

  let throttled = false;
  let flaky = new Set<string>();

  beforeEach(() => {
    clearMemoryCache();
    resetThrottle();
    pageviewsFail = true;
    pageReads = 0;
    throttled = false;
    flaky = new Set();
    mockFetch(async (url) => {
      const q = url.searchParams;
      if (url.host === "ja.wikipedia.org" && url.pathname === "/w/index.php" && q.get("action") === "raw") {
        pageReads++;
        assert.equal(q.get("title"), "2月29日");
        return new Response(BIRTH_PAGE, { status: 200, headers: { "Content-Type": "text/x-wiki" } });
      }
      if (throttled && url.pathname.endsWith("/api.php") && url.host !== "commons.wikimedia.org") {
        return new Response("You are making too many requests to the API.", { status: 429, headers: { "retry-after": "0" } });
      }
      if (url.host === "www.wikidata.org" && url.pathname.startsWith("/wiki/Special:ItemByTitle/jawiki/")) {
        const title = decodeURIComponent(url.pathname.split("/").pop()!).replace(/_/g, " ");
        const target = title === "歌う人 (別名)" ? "歌う 人" : title;
        if (flaky.has(target)) return new Response("", { status: 429, headers: { "retry-after": "0" } });
        const qid = PAGEPROPS[target];
        return qid
          ? new Response(null, { status: 302, headers: { location: `https://www.wikidata.org/wiki/${qid}` } })
          : new Response("<html>not found</html>", { status: 200 });
      }
      if (url.host === "www.wikidata.org" && url.pathname.startsWith("/wiki/Special:EntityData/")) {
        const id = url.pathname.split("/").pop()!.replace(".json", "");
        return ENTITIES[id] ? json({ entities: { [id]: ENTITIES[id] } }) : json({}, 404);
      }
      if (url.host === "ja.wikipedia.org" && q.get("action") === "query") {
        const titles = q.get("titles")!.split("|");
        return json({
          query: {
            // 「歌う人 (別名)」は「歌う 人」へのリダイレクト
            redirects: titles.includes("歌う人 (別名)") ? [{ from: "歌う人 (別名)", to: "歌う 人" }] : [],
            pages: titles
              .filter((t) => t !== "歌う人 (別名)")
              .map((t) =>
                PAGEPROPS[t] ? { title: t, pageprops: { wikibase_item: PAGEPROPS[t] } } : { title: t, missing: true },
              ),
          },
        });
      }
      if (url.host === "www.wikidata.org") {
        const ids = q.get("ids")!.split("|");
        return json({ entities: Object.fromEntries(ids.map((id) => [id, ENTITIES[id] ?? { id, missing: "" }])) });
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

  it("人物・分類・画像がそろい、スコアは選ぶまで取らない", async () => {
    const hand = await getHand(2, 29, NOW);
    assert.equal(hand.mode, "live");
    assert.deepEqual(hand.period, { start: "2025-10", end: "2026-09" });
    const byId = (id: string) => hand.people.find((p) => p.id === id);

    // バンド（人間ではない）は除く。リダイレクト経由の重複は 1 人にまとめる。生まれ年の新しい順
    assert.deepEqual(
      hand.people.map((p) => p.id),
      ["Q1", "Q3", "Q2", "Q55"],
    );

    const singer = byId("Q1")!;
    assert.equal(singer.birthDate, "1990-02-29");
    assert.deepEqual(singer.categories, ["music"]); // 歌手 → 音楽家 と上位分類をたどる
    assert.deepEqual(singer.occupations, [{ id: "Q177220", label: "歌手" }]);
    assert.equal(singer.image?.artist, "Photographer");
    assert.equal(singer.description, "日本の歌手");
    assert.equal(singer.jaTitle, "歌う 人");
    assert.deepEqual(singer.score, { status: "pending" }); // 閲覧数は「このカードで勝負」のときに取る

    const king = byId("Q2")!;
    assert.equal(king.name, "Old King"); // 日本語ラベルがなければ英語
    assert.equal(king.nameRoman, "Old King");
    // Wikidata の日付（ユリウス暦で 2月19日）と月日が違うので、一覧の年とこの月日を使う
    assert.equal(king.birthDate, "1600-02-29");
    assert.equal(king.description, "君主"); // Wikidata に説明がなければ一覧の説明
    assert.deepEqual(king.categories, ["history"]);
    assert.equal(king.score.status, "pending");

    const writer = byId("Q3")!;
    assert.deepEqual(writer.categories, []); // 作家はどのカテゴリーにも入れない
    assert.equal(writer.score.status, "not-fetched");

    assert.equal(byId("Q55")!.birthDate, "-0100-02-29");
    assert.deepEqual(byId("Q55")!.categories, ["knowledge"]);

    // 2 回目はキャッシュから（Wikipedia に問い合わせない）
    await getHand(2, 29, NOW);
    assert.equal(pageReads, 1);

    // 手札を作るときには閲覧数の API を呼ばない
    assert.ok(!calls.some((c) => c.startsWith("wikimedia.org")));
  });

  it("同時に開いても取得は 1 回", async () => {
    // 別の月（＝別の集計期間）にして、前のテストのキャッシュを使わないようにする
    const later = new Date("2026-12-05T00:00:00Z");
    const [a, b] = await Promise.all([getHand(2, 29, later), getHand(2, 29, later)]);
    assert.equal(a, b);
    assert.equal(pageReads, 1);
  });

  it("API が回数制限（429）でも、Wikidata の 1 件ずつの窓口で同じ手札を作る", async () => {
    throttled = true;
    const hand = await getHand(2, 29, new Date("2027-01-10T00:00:00Z"));
    assert.deepEqual(
      hand.people.map((p) => p.id),
      ["Q1", "Q3", "Q2", "Q55"],
    );
    assert.deepEqual(hand.people[0].categories, ["music"]);
    assert.equal(hand.truncated, false);
    assert.ok(calls.some((c) => c.includes("Special:ItemByTitle")));
    assert.ok(calls.some((c) => c.includes("Special:EntityData")));
  });

  it("取れなかった人だけ抜いて手札を作り、その手札は保存しない", async () => {
    throttled = true;
    flaky = new Set(["作家 (小説家)"]); // この人だけ何度やっても 429
    const when = new Date("2027-02-10T00:00:00Z");
    const hand = await getHand(2, 29, when);
    assert.deepEqual(
      hand.people.map((p) => p.id),
      ["Q1", "Q2", "Q55"],
    );
    assert.equal(hand.truncated, true);
    assert.equal(hand.totalFound, 4);
    // 保存していないので、次に開くと取り直す
    flaky = new Set();
    resetThrottle();
    const again = await getHand(2, 29, when);
    assert.equal(again.people.length, 4);
    assert.equal(again.truncated, false);
    assert.equal(pageReads, 2);
  });
});
