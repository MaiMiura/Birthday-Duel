"use client";

import { categoryRule } from "@/lib/categories";
import { approxViews, formatDateTime, formatViews } from "@/lib/game";
import { formatPeriod } from "@/lib/period";
import type { SelectedCard } from "@/lib/types";
import { CardVisual, CategoryLabel, LimeButton, Signature, TopBar } from "./ui";

/** 公開待ち（裏面）と公開（表面）。カードをめくる演出でつなぐ。 */
export default function DuelView({
  card,
  revealed,
  onReveal,
  onReselect,
  onNext,
}: {
  card: SelectedCard;
  revealed: boolean;
  onReveal: () => void;
  onReselect: () => void;
  onNext: () => void;
}) {
  const demo = card.mode === "demo";
  const rule = categoryRule(card.category);
  const { person } = card;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-3 pb-6">
      <TopBar
        demo={demo}
        onBack={revealed ? onNext : onReselect}
        center={
          <span className="relative px-2 text-base font-black">
            {rule.label}
            <span aria-hidden className="absolute inset-x-0 -bottom-1 h-1 -skew-x-12 bg-lime" />
          </span>
        }
      />

      {!revealed && (
        <div className="mt-6 text-center">
          <h1 className="text-4xl font-black">
            <span className="slant">準備はいい？</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            このカードで「{rule.label}」の勝負をします。
            <br />
            全員の準備ができたら、せーので公開しましょう。
          </p>
        </div>
      )}

      <div className="flip-scene mt-5">
        <div className={`flip-card grid ${revealed ? "is-flipped" : ""}`}>
          {/* 裏面: 名前もスコアも出さない */}
          <section
            aria-hidden={revealed}
            className="flip-face col-start-1 row-start-1 mx-auto w-[86%] rounded-3xl bg-surface p-2 shadow-xl"
          >
            <div className="card-back relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl">
              <span aria-hidden className="lime-slash absolute inset-0" />
              <span aria-hidden className="slant relative font-display text-[9rem] leading-none text-[#f2efe6]">
                B<span className="text-lime">/</span>D
              </span>
              <span className="absolute bottom-4 left-4 font-display text-lg leading-none text-white uppercase">
                <span className="slant">
                  Birthday
                  <br />
                  Duel
                </span>
              </span>
              <span className="sr-only">カードは伏せてあります</span>
            </div>
          </section>

          {/* 表面: 公開するまで描画しない（スコアが画面に出ないように） */}
          <section
            aria-hidden={!revealed}
            className="flip-face flip-face-front col-start-1 row-start-1 overflow-hidden rounded-3xl bg-surface shadow-xl"
          >
            {revealed && (
              <>
                <div className="relative p-2 pb-0">
                  <span aria-hidden className="absolute top-10 -right-1 bottom-10 w-2 -skew-y-6 bg-lime" />
                  <CardVisual person={person} className="aspect-[4/4.2] w-full rounded-2xl" large />
                  {demo && (
                    <span className="absolute top-4 right-4 rounded bg-black/75 px-2 py-0.5 text-xs font-bold text-white">
                      DEMO
                    </span>
                  )}
                  <Signature name={person.nameRoman} className="bottom-6 left-6 text-5xl" />
                </div>
                <div className="px-5 pt-3 pb-4">
                  <CategoryLabel id={card.category} mark />
                  <h1 className="mt-1 text-4xl leading-tight font-black">{person.name}</h1>
                  {person.nameRoman && (
                    <p className="mt-1 text-[0.65rem] tracking-[0.45em] text-ink-soft uppercase">{person.nameRoman}</p>
                  )}
                </div>
                <div className="pop-in border-t border-line px-5 pt-3 pb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black">知名度スコア</p>
                    {demo && <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-ink-soft">デモ値</span>}
                  </div>
                  <p className="mt-1 leading-none">
                    <span className="font-display text-[3.6rem] tabular-nums">{formatViews(card.views)}</span>
                    <span className="ml-1 text-xl font-black">回</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
                    <span>Wikipedia閲覧数（{approxViews(card.views)}）</span>
                    <span>{formatPeriod(card.period)}</span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {!revealed ? (
        <div className="mt-6 space-y-2">
          <LimeButton onClick={onReveal}>せーので公開</LimeButton>
          <button type="button" onClick={onReselect} className="min-h-11 w-full text-sm font-bold text-ink-soft underline">
            選び直す
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="text-center text-[0.7rem] leading-relaxed text-ink-soft">
            知名度スコアは Wikipedia 閲覧数をもとにした指標です（日本語版の記事が人に読まれた回数の合計）。
            <br />
            集計期間 {formatPeriod(card.period)}（UTC）・データ取得日 {formatDateTime(card.fetchedAt)}
            <br />
            <strong className="text-ink">相手のカードと集計期間が同じか確かめてから比べてください。</strong>
          </p>
          <LimeButton onClick={onNext}>次の勝負へ</LimeButton>
        </div>
      )}
    </main>
  );
}
