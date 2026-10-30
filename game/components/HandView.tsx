"use client";

import { useEffect, useRef, useState } from "react";
import { formatBirthDate } from "@/lib/birthday";
import { CATEGORIES, categoryRule } from "@/lib/categories";
import { cardState, formatDateTime, visiblePeople } from "@/lib/game";
import { formatPeriod } from "@/lib/period";
import type { Settings } from "@/lib/storage";
import type { CategoryId, Hand, Person } from "@/lib/types";
import { CardVisual, CategoryLabel, GhostButton, LimeButton, Signature, TopBar } from "./ui";

export type Tab = CategoryId | "all";

export default function HandView({
  hand,
  tab,
  settings,
  detail,
  retrying,
  roundCategory,
  onTab,
  onOpen,
  onClose,
  onChoose,
  onHide,
  onChangeBirthday,
  onSettings,
  onRetryScores,
  choosing = false,
  chooseError = null,
}: {
  hand: Hand;
  tab: Tab;
  settings: Settings;
  detail: Person | null;
  retrying: boolean;
  /** 公開画面から決めた次のお題（そのタブを開いているあいだ案内を出す） */
  roundCategory?: CategoryId | null;
  onTab: (t: Tab) => void;
  onOpen: (p: Person) => void;
  onClose: () => void;
  onChoose: (p: Person, c: CategoryId) => void;
  onHide: (p: Person) => void;
  onChangeBirthday: () => void;
  onSettings: () => void;
  onRetryScores: () => void;
  /** 選んだ人のスコアを取っているところ */
  choosing?: boolean;
  chooseError?: string | null;
}) {
  const demo = hand.mode === "demo";
  const people = visiblePeople(hand, tab, settings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tab !== "all" ? people.find((p) => p.id === selectedId && cardState(p, tab).playable) : undefined;
  const failedCount = hand.people.filter((p) => p.score.status === "failed").length;
  const filteredCount = settings.kidsFilter ? hand.people.filter((p) => p.sensitive).length : 0;
  const counts = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, visiblePeople(hand, c.id, settings).length]),
  ) as Record<CategoryId, number>;

  const tap = (p: Person) => {
    // カテゴリーのタブでは、勝負に使えるカードはタップで選ぶ。それ以外は詳細を開く
    if (tab !== "all" && cardState(p, tab).playable) setSelectedId(p.id === selectedId ? null : p.id);
    else onOpen(p);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pt-3 pb-32">
      <TopBar demo={demo} onMenu={onSettings} />

      <header className="mt-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[3.4rem] leading-none">
            <span className="slant lime-mark px-1">
              {hand.month}
              <span className="font-sans text-3xl font-black">月</span>
              {hand.day}
              <span className="font-sans text-3xl font-black">日</span>
            </span>
          </h1>
          <p className="mt-2 flex items-center gap-3 text-base font-black">
            あなたの手札
            <button type="button" onClick={onChangeBirthday} className="min-h-11 text-xs font-bold text-ink-soft underline">
              誕生日を変える
            </button>
          </p>
        </div>
        <p className="mb-12 max-w-32 text-[0.7rem] leading-relaxed text-ink-soft">この日生まれの有名人カードを集めました。</p>
      </header>

      <nav aria-label="カテゴリー" className="-mx-4 mt-2 overflow-x-auto px-4">
        <ul className="flex w-max gap-1 rounded-2xl bg-surface p-1 shadow-sm">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <TabButton
                active={tab === c.id}
                onClick={() => {
                  setSelectedId(null);
                  onTab(c.id);
                }}
                color={tab === c.id ? "" : c.id}
              >
                {c.label}
                <span className="ml-1 text-[0.65rem] opacity-60">{counts[c.id]}</span>
              </TabButton>
            </li>
          ))}
          <li>
            <TabButton
              active={tab === "all"}
              onClick={() => {
                setSelectedId(null);
                onTab("all");
              }}
            >
              図鑑
            </TabButton>
          </li>
        </ul>
      </nav>

      <div className="mt-4 space-y-2">
        {roundCategory && tab === roundCategory && (
          <div role="status" className="flex items-center gap-3 rounded-2xl bg-ink p-4 text-white">
            <span aria-hidden className="h-8 w-1.5 -skew-x-12 bg-lime" />
            <p className="text-base font-black">
              次のお題は「{categoryRule(roundCategory).label}」
              <span className="block text-xs font-bold text-white/70">手札から 1 枚選んで勝負！</span>
            </p>
          </div>
        )}
        <p className="text-xs text-ink-soft">
          {tab !== "all"
            ? `${categoryRule(tab).examples}。カードをタップして選び、下のボタンで勝負。`
            : "同じ誕生日の人物の一覧です。勝負に出すときは、カテゴリーのタブから選んでください。"}
        </p>
        {demo && <Notice>デモモードです。人物は架空で、知名度スコアはデモ値です。</Notice>}
        {hand.truncated && (
          <Notice>
            Wikipedia・Wikidata が混雑していて、{(hand.totalFound - hand.people.length).toLocaleString()}{" "}
            人分を読み込めませんでした。一覧は全員ではありません。時間をおいて開き直すと増えることがあります。
          </Notice>
        )}
        {failedCount > 0 && (
          <Notice>
            <span>{failedCount} 人のスコアを取得できませんでした。そのカードは勝負に使えません。</span>
            <button
              type="button"
              onClick={onRetryScores}
              disabled={retrying || demo}
              className="ml-auto min-h-11 shrink-0 rounded-full bg-ink px-4 text-xs font-bold text-white disabled:opacity-40"
            >
              {retrying ? "再試行中…" : demo ? "（デモ）" : "再試行"}
            </button>
          </Notice>
        )}
        {chooseError && tab === "all" && <Notice>{chooseError}</Notice>}
        {filteredCount > 0 && (
          <p className="text-[0.7rem] text-ink-soft">
            センシティブな人物を {filteredCount} 人非表示にしています（メニューの設定で変更できます）。
          </p>
        )}
      </div>

      {people.length === 0 ? (
        <div className="mt-4 rounded-3xl border-2 border-dashed border-line bg-surface/60 p-6 text-center">
          <p className="text-base font-black">
            {tab === "all"
              ? "この誕生日の人物は見つかりませんでした。"
              : "このカテゴリーのカードはありません。別のカテゴリーで遊ぶか、この勝負はパスしてください"}
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {people.map((p) => (
            <li key={p.id}>
              <PersonTile
                person={p}
                tab={tab}
                demo={demo}
                selected={selected?.id === p.id}
                onTap={() => tap(p)}
                onInfo={() => onOpen(p)}
              />
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-6 text-[0.7rem] leading-relaxed text-ink-soft">
        知名度スコアは日本語版 Wikipedia の閲覧数をもとにした指標です。集計期間 {formatPeriod(hand.period)}
        （UTC）・データ取得日 {formatDateTime(hand.fetchedAt)}。人物データ: Wikipedia・Wikidata（CC0）。
      </footer>

      {tab !== "all" && people.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-linear-to-t from-paper via-paper/90 to-transparent px-4 pt-6 pb-5">
          <div className="mx-auto max-w-md">
            {chooseError && (
              <p role="alert" className="mb-2 rounded-2xl bg-ink px-4 py-3 text-xs font-bold text-white">
                {chooseError}
              </p>
            )}
            <LimeButton disabled={!selected || choosing} onClick={() => selected && onChoose(selected, tab)}>
              {choosing ? "スコアを確認中…" : selected ? "このカードで勝負" : "カードを選んでください"}
            </LimeButton>
          </div>
        </div>
      )}

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
  color?: CategoryId | "";
}) {
  const text = {
    entertainment: "text-cat-entertainment",
    music: "text-cat-music",
    sports: "text-cat-sports",
    knowledge: "text-cat-knowledge",
    history: "text-cat-history",
  };
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative min-h-11 rounded-xl px-4 text-sm font-black whitespace-nowrap ${
        active ? "bg-ink text-white" : color ? text[color] : "text-ink"
      }`}
    >
      {children}
      {active && <span aria-hidden className="absolute inset-x-4 bottom-1.5 h-1 -skew-x-12 bg-lime" />}
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-xs leading-relaxed shadow-sm">{children}</div>;
}

function PersonTile({
  person,
  tab,
  demo,
  selected,
  onTap,
  onInfo,
}: {
  person: Person;
  tab: Tab;
  demo: boolean;
  selected: boolean;
  onTap: () => void;
  onInfo: () => void;
}) {
  const state = cardState(person, tab);
  const cat = tab !== "all" ? tab : person.categories[0];
  return (
    <div
      className={`relative h-full overflow-hidden rounded-2xl bg-surface p-1.5 shadow-sm transition ${
        selected ? "ring-4 ring-lime" : ""
      }`}
    >
      <button type="button" onClick={onTap} aria-pressed={selected} className="block w-full text-left">
        <div className="relative">
          <CardVisual person={person} className={`aspect-[4/5] w-full rounded-xl ${state.playable ? "" : "opacity-45"}`} />
          {demo && (
            <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 text-[0.6rem] font-bold text-white">
              DEMO
            </span>
          )}
          {!state.playable && (
            <span className="absolute bottom-2 left-2 rounded-md bg-black/80 px-2 py-0.5 text-[0.7rem] font-bold text-white">
              × {state.label}
            </span>
          )}
          {selected && (
            <span className="absolute bottom-2 left-2 rounded-md bg-lime px-2 py-0.5 text-[0.7rem] font-black text-ink">
              ✓ 選択中
            </span>
          )}
        </div>
        <div className="px-1.5 pt-2 pb-1">
          <p className="text-base leading-snug font-black">{person.name}</p>
          <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-ink-soft">{person.description ?? "紹介文はありません"}</p>
          {cat && (
            <p className="mt-1">
              <CategoryLabel id={cat} />
            </p>
          )}
        </div>
      </button>
      <button
        type="button"
        onClick={onInfo}
        aria-label={`${person.name}の詳細`}
        className="absolute top-2.5 left-2.5 flex size-8 items-center justify-center rounded-full bg-white/85 text-sm font-black text-ink shadow"
      >
        i
      </button>
    </div>
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
        className="sheet-up max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface sm:rounded-3xl"
      >
        <div className="relative">
          <CardVisual person={person} className="aspect-[16/11] w-full sm:rounded-t-3xl" large />
          <Signature name={person.nameRoman} className="bottom-6 left-5 text-4xl" />
        </div>
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-3">
            {person.categories.map((c) => (
              <CategoryLabel key={c} id={c} mark />
            ))}
          </div>
          <h2 className="text-3xl font-black">{person.name}</h2>
          {person.nameRoman && (
            <p className="text-xs tracking-[0.35em] text-ink-soft uppercase">{person.nameRoman}</p>
          )}
          <p className="text-sm">{person.description ?? <span className="text-ink-soft">紹介文はありません</span>}</p>
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
            <p className="rounded-2xl bg-paper p-3 text-sm">
              <strong>× {state.label}</strong>：{state.detail}
            </p>
          )}

          <div className="space-y-2 pt-1">
            {playable.map((c) => (
              <LimeButton key={c} onClick={() => onChoose(c)}>
                {tab === "all" ? `「${categoryRule(c).label}」でこのカードで勝負` : "このカードで勝負"}
              </LimeButton>
            ))}
            <GhostButton onClick={onHide}>このカードを外す</GhostButton>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="min-h-12 w-full text-sm font-bold text-ink-soft underline"
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
