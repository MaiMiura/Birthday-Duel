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
      <header className="sticky top-0 z-10 border-b border-line bg-bg/95 px-4 pt-3 pb-2 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <ModeBadge demo={demo} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onChangeBirthday}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-bold"
            >
              誕生日を変える
            </button>
            <button
              type="button"
              onClick={onSettings}
              aria-label="設定"
              className="min-h-11 min-w-11 rounded-lg border border-line bg-surface px-3 text-base"
            >
              ⚙
            </button>
          </div>
        </div>
        <h1 className="mt-3 text-center">
          <span className="block text-xs font-bold tracking-[0.3em] text-ink-soft">YOUR BIRTHDAY</span>
          <span className="block text-4xl font-bold tracking-wide text-gold">{formatBirthday(hand)}</span>
        </h1>
        <nav aria-label="カテゴリー" className="-mx-4 mt-3 overflow-x-auto px-4">
          <ul className="flex w-max gap-2 pb-1">
            {CATEGORIES.map((c) => (
              <li key={c.id}>
                <TabButton active={tab === c.id} onClick={() => onTab(c.id)} activeBg={CATEGORY_STYLE[c.id].bg}>
                  {c.label}
                  <span className="ml-1.5 text-xs opacity-75">{counts[c.id]}</span>
                </TabButton>
              </li>
            ))}
            <li>
              <TabButton active={tab === "all"} onClick={() => onTab("all")}>
                図鑑（すべて）
              </TabButton>
            </li>
          </ul>
        </nav>
      </header>

      <div className="space-y-3 px-4 pt-4">
        <p className="text-sm text-ink-soft">
          {tab !== "all"
            ? `${categoryRule(tab).examples}。勝負に出す 1 枚を選んでください。`
            : "同じ誕生日の人物の一覧です。勝負に出すときは、カテゴリーのタブから選んでください。"}
        </p>

        {demo && <Notice tone="demo">デモモードです。人物は架空で、知名度スコアはデモ値です。</Notice>}
        {hand.truncated && (
          <Notice>
            人数が多いため、記事のある言語数が多い順に {hand.people.length.toLocaleString()} 人まで表示しています（全{" "}
            {hand.totalFound.toLocaleString()} 人中）。一覧は全員ではありません。
          </Notice>
        )}
        {failedCount > 0 && (
          <Notice tone="warn">
            <span>{failedCount} 人のスコアを取得できませんでした。そのカードは勝負に使えません。</span>
            <button
              type="button"
              onClick={onRetryScores}
              disabled={retrying || demo}
              className="ml-auto min-h-11 shrink-0 rounded-lg border border-gold px-3 font-bold text-gold disabled:opacity-50"
            >
              {retrying ? "再試行中…" : demo ? "（デモ）" : "再試行"}
            </button>
          </Notice>
        )}
        {filteredCount > 0 && (
          <p className="text-xs text-ink-soft">センシティブな人物を {filteredCount} 人非表示にしています（設定で変更できます）。</p>
        )}

        {people.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="text-lg font-bold">
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
  activeBg = "bg-ink",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeBg?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-bold whitespace-nowrap ${
        active
          ? `${activeBg} border-transparent ${activeBg === "bg-ink" ? "text-bg" : "text-white"} underline decoration-2 underline-offset-4`
          : "border-line bg-surface text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "demo" }) {
  const style = {
    info: "border-line bg-surface",
    warn: "border-gold/60 bg-surface",
    demo: "border-dashed border-gold/60 bg-surface",
  }[tone];
  const label = { info: "INFO", warn: "注意", demo: "DEMO" }[tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${style}`}>
      <span className="shrink-0 text-xs font-bold tracking-wide text-gold">{label}</span>
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
      className={`flex h-full w-full flex-col overflow-hidden rounded-xl border bg-surface text-left transition active:scale-[0.98] ${
        state.playable ? "border-line" : "border-dashed border-line"
      }`}
    >
      <div className="relative">
        <CardVisual person={person} category={cat} className={`aspect-[4/3] w-full ${state.playable ? "" : "opacity-50"}`} />
        {!state.playable && (
          <span className="absolute top-2 left-2 rounded bg-black/80 px-2 py-0.5 text-xs font-bold text-white">
            × {state.label}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <span className="text-base leading-snug font-bold">{person.name}</span>
        <span className="line-clamp-2 text-xs text-ink-soft">{person.description ?? "紹介文はありません"}</span>
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
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/70 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${person.name}のくわしい情報`}
        onClick={(e) => e.stopPropagation()}
        className="sheet-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-line bg-surface sm:rounded-2xl"
      >
        <CardVisual
          person={person}
          category={tab !== "all" ? tab : undefined}
          className="aspect-[16/10] w-full sm:rounded-t-2xl"
          large
        />
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-1">
            {person.categories.map((c) => (
              <CategoryBadge key={c} id={c} />
            ))}
          </div>
          <h2 className="text-2xl font-bold">{person.name}</h2>
          <p className="text-base">{person.description ?? <span className="text-ink-soft">紹介文はありません</span>}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-ink-soft">生年月日</dt>
            <dd>
              {formatBirthDate(person.birthDate)}
              {person.julian && <span className="block text-xs text-ink-soft">ユリウス暦の記録をグレゴリオ暦に換算した日付</span>}
            </dd>
            <dt className="text-ink-soft">職業</dt>
            <dd>{person.occupations.map((o) => o.label).join("、") || "登録なし"}</dd>
            {person.nameLang !== "ja" && (
              <>
                <dt className="text-ink-soft">名前</dt>
                <dd>日本語の名前が登録されていないため、{person.nameLang} の表記です</dd>
              </>
            )}
          </dl>

          {!state.playable && (
            <p className="rounded-lg border border-dashed border-line p-3 text-sm">
              <strong>× {state.label}</strong>：{state.detail}
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
              className="min-h-12 w-full rounded-xl text-base font-bold text-ink-soft underline"
            >
              閉じる
            </button>
          </div>

          <section className="border-t border-line pt-3 text-xs leading-relaxed text-ink-soft">
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
