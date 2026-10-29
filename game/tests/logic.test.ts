import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { daysInMonth, formatBirthDate, isValidBirthday, parseBirthday } from "../lib/birthday";
import { classify, sensitiveReason, type AncestorMap } from "../lib/classify";
import { getDemoHand } from "../lib/demo";
import { approxViews, cardState, formatViews, selectCard, visiblePeople } from "../lib/game";
import { formatPeriod, periodDays, periodMonths, scorePeriod } from "../lib/period";

describe("誕生日", () => {
  it("2月29日を選べる", () => {
    assert.equal(daysInMonth(2), 29);
    assert.ok(isValidBirthday(2, 29));
    assert.deepEqual(parseBirthday("02-29"), { month: 2, day: 29 });
  });
  it("存在しない日付ははじく", () => {
    assert.equal(isValidBirthday(2, 30), false);
    assert.equal(isValidBirthday(4, 31), false);
    assert.equal(isValidBirthday(13, 1), false);
    assert.equal(parseBirthday("2-30"), null);
    assert.equal(parseBirthday("abc"), null);
  });
  it("いろいろな書き方を読める", () => {
    assert.deepEqual(parseBirthday("10-29"), { month: 10, day: 29 });
    assert.deepEqual(parseBirthday("1029"), { month: 10, day: 29 });
    assert.deepEqual(parseBirthday("1/5"), { month: 1, day: 5 });
  });
  it("紀元前の生年を表示できる", () => {
    assert.equal(formatBirthDate("-0100-07-12"), "紀元前100年7月12日");
    assert.equal(formatBirthDate("1987-10-29"), "1987年10月29日");
  });
});

describe("集計期間", () => {
  it("直近の完了した月までの 12 か月", () => {
    const p = scorePeriod(new Date("2026-10-29T12:00:00Z"));
    assert.deepEqual(p, { start: "2025-10", end: "2026-09" });
    assert.equal(formatPeriod(p), "2025年10月〜2026年9月");
    assert.deepEqual(periodDays(p), { first: "20251001", last: "20260930" });
    assert.equal(periodMonths(p).length, 12);
  });
  it("1 月は前の年の 12 月まで", () => {
    assert.deepEqual(scorePeriod(new Date("2026-01-15T00:00:00Z")), { start: "2025-01", end: "2025-12" });
  });
  it("端末のタイムゾーンによらず UTC で決まる", () => {
    // 日本時間では 11 月 1 日だが、UTC ではまだ 10 月 31 日
    assert.deepEqual(scorePeriod(new Date("2026-11-01T08:30:00+09:00")), { start: "2025-10", end: "2026-09" });
    assert.deepEqual(scorePeriod(new Date("2026-11-01T09:30:00+09:00")), { start: "2025-11", end: "2026-10" });
  });
  it("うるう年の 2 月末", () => {
    assert.equal(periodDays({ start: "2023-03", end: "2024-02" }).last, "20240229");
  });
});

describe("カテゴリー分類", () => {
  const ancestors: AncestorMap = new Map([
    ["Q_POPSINGER", new Set(["Q177220", "Q639669"])], // singer, musician の下位分類
    ["Q_FOOTBALLER", new Set(["Q2066131"])], // athlete の下位分類
    ["Q_AV", new Set(["Q488111", "Q33999"])], // pornographic actor（actor の下位分類でもある）
  ]);
  it("職業 ID と上位分類で判定し、複数カテゴリーにも入る", () => {
    assert.deepEqual(classify(["Q_POPSINGER", "Q33999"], ancestors), ["entertainment", "music"]);
    assert.deepEqual(classify(["Q_FOOTBALLER"], ancestors), ["sports"]);
  });
  it("分類できない職業は無理に割り当てない", () => {
    assert.deepEqual(classify(["Q36180"], ancestors), []); // writer
    assert.deepEqual(classify([], ancestors), []);
  });
  it("子ども向けフィルターの判定", () => {
    assert.equal(sensitiveReason(["Q_AV"], null, ancestors), "アダルト作品への出演");
    assert.equal(sensitiveReason(["Q33999"], "日本のタレント、元AV女優", ancestors), "アダルト作品への出演");
    assert.equal(sensitiveReason(["Q33999"], "日本の俳優", ancestors), null);
  });
});

describe("カードとスコア", () => {
  const now = new Date("2026-10-29T00:00:00Z");
  const hand = getDemoHand(10, 29, now)!;
  const byName = (name: string) => hand.people.find((p) => p.name === name)!;

  it("スコア 0 は勝負に使える", () => {
    assert.deepEqual(cardState(byName("雲野 まり"), "entertainment"), { playable: true });
    assert.equal(formatViews(0), "0");
    assert.equal(approxViews(0), "0回");
  });
  it("取得失敗・日本語版なし・部門なしは勝負に使えない", () => {
    assert.equal(cardState(byName("風間 つよし"), "sports").playable, false);
    assert.equal(cardState(byName("Emma Nordlund"), "music").playable, false);
    assert.equal(cardState(byName("筆野 ことは"), "all").playable, false);
    assert.throws(() => selectCard(hand, byName("風間 つよし"), "sports"));
  });
  it("選んだ時点の値で固定される", () => {
    const person = byName("星野 そら");
    const card = selectCard(hand, person, "music", now);
    (person.score as { views: number }).views = 1;
    assert.equal(card.views, 1_234_567);
    assert.deepEqual(card.period, { start: "2025-10", end: "2026-09" });
    assert.equal(card.mode, "demo");
  });
  it("子ども向けフィルターと外したカード", () => {
    const all = visiblePeople(hand, "history", { kidsFilter: false, hiddenIds: [] });
    const kids = visiblePeople(hand, "history", { kidsFilter: true, hiddenIds: [] });
    assert.equal(all.length - kids.length, 1);
    const hidden = visiblePeople(hand, "history", { kidsFilter: true, hiddenIds: [kids[0].id] });
    assert.equal(hidden.length, kids.length - 1);
  });
  it("2月29日のデモには候補のいないカテゴリーがある", () => {
    const leap = getDemoHand(2, 29, now)!;
    assert.equal(visiblePeople(leap, "knowledge", { kidsFilter: true, hiddenIds: [] }).length, 0);
    assert.ok(visiblePeople(leap, "sports", { kidsFilter: true, hiddenIds: [] }).length > 0);
  });
  it("画像なしの人物もいる", () => {
    assert.ok(hand.people.some((p) => p.image === null));
    assert.ok(hand.people.some((p) => p.image !== null));
  });
  it("大きな数の言い方", () => {
    assert.equal(approxViews(1_234_567), "約123万回");
    assert.equal(approxViews(9_999), "9,999回");
    assert.equal(approxViews(250_000_000), "約2.5億回");
  });
});
