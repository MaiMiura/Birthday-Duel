"use client";

import { categoryRule } from "@/lib/categories";
import { approxViews, formatDateTime, formatViews } from "@/lib/game";
import { formatPeriod } from "@/lib/period";
import type { SelectedCard } from "@/lib/types";
import { BigButton, CardVisual, CategoryBadge, CATEGORY_STYLE, ModeBadge } from "./ui";

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
  const style = CATEGORY_STYLE[card.category];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <ModeBadge demo={demo} />
        <CategoryBadge id={card.category} />
      </div>

      {!revealed && (
        <div className="text-center">
          <p className="text-xs font-bold tracking-[0.3em] text-gold">ROUND</p>
          <p className="mt-1 text-2xl font-bold">{rule.label}で勝負</p>
          <p className="mt-1 text-base text-ink-soft">全員の準備ができたら、せーので公開</p>
        </div>
      )}

      <div className="flip-scene">
        <div className={`flip-card grid ${revealed ? "is-flipped" : ""}`}>
          {/* 裏面: 名前もスコアも出さない */}
          <section
            aria-hidden={revealed}
            className="flip-face card-back-pattern col-start-1 row-start-1 flex min-h-[26rem] flex-col items-center justify-center rounded-2xl border-2 border-gold/70 p-6 text-center shadow-[0_12px_40px_rgb(0_0_0/0.6)]"
          >
            <div className="flex size-28 items-center justify-center rounded-full border-2 border-gold/70 bg-bg/80">
              <span className="text-6xl font-bold text-gold">?</span>
            </div>
            <p className="mt-6 text-xs font-bold tracking-[0.4em] text-gold">BIRTHDAY DUEL</p>
            <p className="mt-2 text-sm text-ink-soft">カードは伏せてあります</p>
            <p className="mt-6 rounded-full border border-gold/60 bg-bg/80 px-4 py-1 text-base font-bold text-gold">
              {rule.label}
            </p>
          </section>

          {/* 表面: 公開するまで描画しない（スコアが画面に出ないように） */}
          <section
            aria-hidden={!revealed}
            className={`flip-face flip-face-front col-start-1 row-start-1 overflow-hidden rounded-2xl border-2 bg-surface shadow-[0_12px_40px_rgb(0_0_0/0.6)] ${style.border}`}
          >
            {revealed && (
              <>
                <CardVisual person={card.person} category={card.category} className="aspect-[16/10] w-full" large />
                <div className="space-y-2 p-4 text-center">
                  <h1 className="text-3xl leading-tight font-bold">{card.person.name}</h1>
                  {card.person.description && <p className="text-sm text-ink-soft">{card.person.description}</p>}
                  <div className="pop-in rounded-xl border border-gold/50 bg-bg px-3 py-4">
                    <p className="text-xs font-bold tracking-[0.3em] text-ink-soft">
                      SCORE
                      {demo && (
                        <span className="ml-2 rounded border border-dashed border-gold px-1.5 tracking-normal text-gold">
                          デモ値
                        </span>
                      )}
                    </p>
                    <p className="mt-1 leading-none font-bold text-gold">
                      <span className="text-5xl tabular-nums">{formatViews(card.views)}</span>
                      <span className="ml-1 text-xl">回</span>
                    </p>
                    <p className="mt-2 text-base font-bold">{approxViews(card.views)}</p>
                    <p className="mt-2 text-xs text-ink-soft">集計 {formatPeriod(card.period)}</p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {!revealed ? (
        <div className="space-y-3">
          <BigButton variant="reveal" onClick={onReveal}>
            せーので公開
          </BigButton>
          <BigButton variant="secondary" onClick={onReselect}>
            選び直す
          </BigButton>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface p-3 text-sm leading-relaxed">
            <p className="font-bold">知名度スコアは Wikipedia 閲覧数をもとにした指標です</p>
            <p className="text-ink-soft">
              日本語版 Wikipedia の記事が人に読まれた回数の合計
              <br />
              集計期間: <strong className="text-ink">{formatPeriod(card.period)}</strong>（UTC）
              <br />
              データ取得日: {formatDateTime(card.fetchedAt)}
            </p>
            <p className="mt-1 text-gold">相手のカードと集計期間が同じか確かめてから比べてください。</p>
          </div>
          <BigButton onClick={onNext}>次の勝負へ</BigButton>
        </div>
      )}
    </main>
  );
}
