"use client";

import { useEffect, useRef } from "react";
import { formatBirthDate, formatBirthday } from "@/lib/birthday";
import { CATEGORIES, categoryRule } from "@/lib/categories";
import { cardState, formatDateTime, visiblePeople } from "@/lib/game";
import { formatPeriod } from "@/lib/period";
import type { Settings } from "@/lib/storage";
import type { CategoryId, Hand, Person } from "@/lib/types";
import { BigButton, CardVisual, CategoryBadge, CATEGORY_STYLE, ModeBadge } from "./ui";

export type Tab = CategoryId | "all";

export default function HandView({
  hand,
  tab,
  settings,
  detail,
  retrying,
  onTab,
  onOpen,
  onClose,
  onChoose,
  onHide,
  onChangeBirthday,
  onSettings,
  onRetryScores,
}: {
  hand: Hand;
  tab: Tab;
  settings: Settings;
  detail: Person | null;
  retrying: boolean;
  onTab: (t: Tab) => void;
  onOpen: (p: Person) => void;
  onClose: () => void;
  onChoose: (p: Person, c: CategoryId) => void;
  onHide: (p: Person) => void;
  onChangeBirthday: () => void;
  onSettings: () => void;
  onRetryScores: () => void;
}) {
  const demo = hand.mode === "demo";
  const people = visiblePeople(hand, tab, settings);
  const failedCount = hand.people.filter((p) => p.score.status === "failed").length;
  const filteredCount = settings.kidsFilter ? hand.people.filter((p) => p.sensitive).length : 0;
  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, visiblePeople(hand, c.id, settings).length]),
  ) as Record<CategoryId, number>;

  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-16">
      <header className="sticky top-0 z-10 border-b-2 border-stone-200 bg-paper/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <ModeBadge demo={demo} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onChangeBirthday}
              className="min-h-11 rounded-xl border-2 border-stone-300 bg-white px-3 text-sm font-bold"
            >
              誕生日を変える
            </button>
            <button
              type="button"
              onClick={onSettings}
              aria-label="設定"
              className="min-h-11 min-w-11 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg"
            >
              ⚙️
            </button>
          </div>
        </div>
        <h1 className="mt-2 text-center">
          <span className="block text-sm font-bold text-ink-soft">あなたの誕生日</span>
          <span className="block text-4xl font-black text-brand">{formatBirthday(hand)}</span>
        </h1>
        <nav aria-label="カテゴリー" className="-mx-4 mt-3 overflow-x-auto px-4">
          <ul className="flex w-max gap-2 pb-1">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <TabButton active={tab === c.id} onClick={() => onTab(c.id)} color={CATEGORY_STYLE[c.id]}>
                  <span aria-hidden>{c.emoji}</span> {c.label}
                  <span className="ml-1 text-xs opacity-80">{counts[c.id]}</span>
                </TabButton>
              </li>
            ))}
            <li>
              <TabButton active={tab === "all"} onClick={() => onTab("all")}>
                📖 図鑑（すべて）
              </TabButton>
            </li>
          </ul>
        </nav>
      </header>

      <div className="space-y-3 px-4 pt-4">
        {tab !== "all" ? (
          <p className="text-sm text-ink-soft">
            {categoryRule(tab).examples}。カードをタップして、勝負に出す 1 枚をえらんでね。
          </p>
        ) : (
          <p className="text-sm text-ink-soft">
            同じ誕生日の人物の一覧です。勝負に出すときはカテゴリーのタブからえらんでね。
          </p>
        )}

        {demo && (
          <Notice tone="demo">
            デモモードです。人物は架空で、知名度スコアはデモ値です。
          </Notice>
        )}
        {hand.truncated && (
          <Notice>
            人数が多いため、記事のある言語数が多い順に {hand.people.length.toLocaleString()} 人まで表示しています（全{" "}
            {hand.totalFound.toLocaleString()} 人中）。一覧は全員ではありません。
          </Notice>
        )}
        {failedCount > 0 && (
          <Notice tone="warn">
            <span>
              {failedCount} 人のスコアを取得できませんでした。そのカードは勝負に使えません。
            </span>
            <button
              type="button"
              onClick={onRetryScores}
              disabled={retrying || demo}
              className="ml-auto min-h-11 shrink-0 rounded-xl bg-white px-3 font-bold text-amber-900 disabled:opacity-50"
            >
              {retrying ? "再試行中…" : demo ? "（デモ）" : "再試行"}
            </button>
          </Notice>
        )}
        {filteredCount > 0 && (
          <p className="text-xs text-ink-soft">子ども向けフィルターで {filteredCount} 人を隠しています（設定で変更できます）。</p>
        )}

        {people.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-stone-300 bg-white p-6 text-center">
            <p className="text-4xl" aria-hidden>
              🃏
            </p>
            <p className="mt-2 text-lg font-bold">
              {tab === "all"
                ? "この誕生日の人物は見つかりませんでした。"
                : "このカテゴリーのカードはありません。別のカテゴリーで遊ぶか、この勝負はパスしてください"}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {people.map((p) => (
              <li key={p.id}>
                <PersonTile person={p} tab={tab} onOpen={() => onOpen(p)} />
              </li>
            ))}
          </ul>
        )}

        <footer className="pt-4 text-xs leading-relaxed text-ink-soft">
          知名度スコアは日本語版 Wikipedia の閲覧数をもとにした指標です。集計期間 {formatPeriod(hand.period)}
          （UTC）・データ取得日 {formatDateTime(hand.fetchedAt)}。人物データ: Wikidata（CC0）。
        </footer>
      </div>

      {detail && (
        <DetailSheet
          person={detail}
          tab={tab}
          onClose={onClose}
          onChoose={(c) => onChoose(detail, c)}
          onHide={() => onHide(detail)}
        />
      )}
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: { bg: string; border: string; text: string };
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border-2 px-4 text-base font-bold whitespace-nowrap ${
        active
          ? `${color?.bg ?? "bg-ink"} ${color?.border ?? "border-ink"} text-white underline decoration-2 underline-offset-4`
          : `bg-white ${color?.border ?? "border-stone-300"} ${color?.text ?? "text-ink"}`
      }`}
    >
      {active && <span aria-hidden>✓ </span>}
      {children}
    </button>
  );
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "demo" }) {
  const style = {
    info: "border-sky-300 bg-sky-50 text-sky-950",
    warn: "border-amber-400 bg-amber-50 text-amber-950",
    demo: "border-dashed border-amber-500 bg-amber-50 text-amber-950",
  }[tone];
  const icon = { info: "ℹ️", warn: "⚠️", demo: "🧪" }[tone];
  return (
    <div className={`flex items-center gap-2 rounded-2xl border-2 p-3 text-sm ${style}`}>
      <span aria-hidden>{icon}</span>
      {children}
    </div>
  );
}

function PersonTile({ person, tab, onOpen }: { person: Person; tab: Tab; onOpen: () => void }) {
  const state = cardState(person, tab);
  const cat = tab !== "all" ? tab : person.categories[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border-2 bg-white text-left shadow-sm transition active:scale-[0.98] ${
        state.playable ? "border-stone-200" : "border-dashed border-stone-300"
      }`}
    >
      <div className="relative">
        <CardVisual person={person} category={cat} className={`aspect-[4/3] w-full ${state.playable ? "" : "opacity-60"}`} />
        {!state.playable && (
          <span className="absolute top-2 left-2 rounded-md bg-stone-800/85 px-2 py-0.5 text-xs font-bold text-white">
            🚫 {state.label}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="text-base leading-snug font-black">{person.name}</span>
        <span className="line-clamp-2 text-xs text-ink-soft">
          {person.description ?? "紹介文はありません"}
        </span>
        <span className="mt-auto flex flex-wrap gap-1 pt-1">
          {person.categories.map((c) => (
            <CategoryBadge key={c} id={c} />
          ))}
        </span>
      </div>
    </button>
  );
}

function DetailSheet({
  person,
  tab,
  onClose,
  onChoose,
  onHide,
}: {
  person: Person;
  tab: Tab;
  onClose: () => void;
  onChoose: (c: CategoryId) => void;
  onHide: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 図鑑タブでは、その人が入っているカテゴリーごとに勝負ボタンを出す
  const choices: CategoryId[] = tab === "all" ? person.categories : [tab];
  const playable = choices.filter((c) => cardState(person, c).playable);
  const state = cardState(person, tab);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${person.name}のくわしい情報`}
        onClick={(e) => e.stopPropagation()}
        className="sheet-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl"
      >
        <CardVisual
          person={person}
          category={tab !== "all" ? tab : undefined}
          className="aspect-[4/3] w-full sm:rounded-t-3xl"
          large
        />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-1">
            {person.categories.map((c) => (
              <CategoryBadge key={c} id={c} />
            ))}
          </div>
          <h2 className="text-2xl font-black">{person.name}</h2>
          <p className="text-base">{person.description ?? <span className="text-ink-soft">紹介文はありません</span>}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-bold text-ink-soft">生年月日</dt>
            <dd>
              {formatBirthDate(person.birthDate)}
              {person.julian && <span className="block text-xs text-ink-soft">ユリウス暦の記録をグレゴリオ暦に換算した日付</span>}
            </dd>
            <dt className="font-bold text-ink-soft">職業</dt>
            <dd>{person.occupations.map((o) => o.label).join("、") || "登録なし"}</dd>
            {person.nameLang !== "ja" && (
              <>
                <dt className="font-bold text-ink-soft">名前</dt>
                <dd>日本語の名前が登録されていないため、{person.nameLang} の表記です</dd>
              </>
            )}
          </dl>

          {!state.playable && (
            <p className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-3 text-sm">
              🚫 <strong>{state.label}</strong>：{state.detail}
            </p>
          )}

          <div className="space-y-2 pt-1">
            {playable.map((c) => (
              <BigButton key={c} onClick={() => onChoose(c)}>
                {tab === "all" ? `「${categoryRule(c).label}」でこのカードで勝負` : "このカードで勝負"}
              </BigButton>
            ))}
            <BigButton variant="secondary" onClick={onHide}>
              このカードを外す
            </BigButton>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="min-h-12 w-full rounded-2xl text-base font-bold text-ink-soft underline"
            >
              閉じる
            </button>
          </div>

          <section className="border-t border-stone-200 pt-3 text-xs leading-relaxed text-ink-soft">
            <h3 className="font-bold">出典</h3>
            <ul className="mt-1 space-y-1">
              {person.jaUrl && (
                <li>
                  <a className="underline" href={person.jaUrl} target="_blank" rel="noreferrer">
                    日本語版 Wikipedia「{person.jaTitle}」
                  </a>
                </li>
              )}
              {person.wikidataUrl && (
                <li>
                  <a className="underline" href={person.wikidataUrl} target="_blank" rel="noreferrer">
                    Wikidata {person.id}
                  </a>
                  （人物データ・CC0）
                </li>
              )}
              {person.image && (
                <li>
                  画像:{" "}
                  <a className="underline" href={person.image.pageUrl} target="_blank" rel="noreferrer">
                    {person.image.artist}
                  </a>
                  {" / "}
                  {person.image.licenseUrl ? (
                    <a className="underline" href={person.image.licenseUrl} target="_blank" rel="noreferrer">
                      {person.image.license}
                    </a>
                  ) : (
                    person.image.license
                  )}
                </li>
              )}
              {!person.wikidataUrl && <li>デモ用の架空の人物です。</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
