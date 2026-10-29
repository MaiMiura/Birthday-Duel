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
    <main className={`mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-4 ${revealed ? "bg-white" : ""}`}>
      <div className="flex items-center justify-between">
        <ModeBadge demo={demo} />
        <CategoryBadge id={card.category} />
      </div>

      {!revealed && (
        <div className="text-center">
          <p className="text-2xl font-black">
            <span aria-hidden>{rule.emoji}</span> {rule.label}で勝負！
          </p>
          <p className="mt-1 text-lg">みんなの準備ができたら公開しよう</p>
        </div>
      )}

      <div className="flip-scene">
        <div className={`flip-card grid ${revealed ? "is-flipped" : ""}`}>
          {/* 裏面: 名前もスコアも出さない */}
          <section
            aria-hidden={revealed}
            className="flip-face card-back-pattern col-start-1 row-start-1 flex min-h-[26rem] flex-col items-center justify-center rounded-3xl border-8 border-white p-6 text-center text-white shadow-xl"
          >
            <p className="text-7xl" aria-hidden>
              🎂
            </p>
            <p className="mt-4 text-3xl font-black tracking-widest">？？？</p>
            <p className="mt-2 text-base opacity-90">カードは伏せてあります</p>
            <p className="mt-6 rounded-full bg-white/20 px-4 py-1 text-lg font-bold">
              {rule.emoji} {rule.label}
            </p>
          </section>

          {/* 表面: 公開するまで描画しない（スコアが画面に出ないように） */}
          <section
            aria-hidden={!revealed}
            className={`flip-face flip-face-front col-start-1 row-start-1 overflow-hidden rounded-3xl border-8 bg-white shadow-xl ${style.border}`}
          >
            {revealed && (
              <>
                <CardVisual person={card.person} category={card.category} className="aspect-[16/10] w-full" large />
                <div className="space-y-2 p-4 text-center">
                  <h1 className="text-3xl leading-tight font-black">{card.person.name}</h1>
                  {card.person.description && <p className="text-sm text-ink-soft">{card.person.description}</p>}
                  <div className="pop-in rounded-2xl bg-ink px-3 py-4 text-white">
                    <p className="text-sm font-bold opacity-80">
                      知名度スコア{demo && <span className="ml-1 rounded bg-amber-400 px-1.5 text-ink">デモ値</span>}
                    </p>
                    <p className="font-black leading-none">
                      <span className="text-5xl tabular-nums">{formatViews(card.views)}</span>
                      <span className="ml-1 text-2xl">回</span>
                    </p>
                    <p className="mt-1 text-lg font-bold">（{approxViews(card.views)}）</p>
                    <p className="mt-2 text-sm font-bold opacity-90">集計 {formatPeriod(card.period)}</p>
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
            せーので公開！
          </BigButton>
          <BigButton variant="secondary" onClick={onReselect}>
            選び直す
          </BigButton>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-stone-300 bg-paper p-3 text-sm leading-relaxed">
            <p className="font-bold">知名度スコアは Wikipedia 閲覧数をもとにした指標です</p>
            <p>
              日本語版 Wikipedia の記事が人に読まれた回数の合計
              <br />
              集計期間: <strong className="text-base">{formatPeriod(card.period)}</strong>（UTC）
              <br />
              データ取得日: {formatDateTime(card.fetchedAt)}
            </p>
            <p className="mt-1 text-ink-soft">⚠️ 相手のカードと集計期間が同じか確かめてから比べてね。</p>
          </div>
          <BigButton onClick={onNext}>次の勝負へ</BigButton>
        </div>
      )}
    </main>
  );
}
