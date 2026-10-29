"use client";

import { useState } from "react";
import { daysInMonth, type Birthday } from "@/lib/birthday";
import { DEMO_BIRTHDAYS } from "@/lib/demo";
import { BigButton, ModeBadge } from "./ui";

export default function BirthdayForm({
  initial,
  demo,
  onSubmit,
  onToggleDemo,
  onCancel,
}: {
  initial: Birthday | null;
  demo: boolean;
  onSubmit: (b: Birthday) => void;
  onToggleDemo: (on: boolean) => void;
  onCancel?: () => void;
}) {
  const [month, setMonth] = useState(initial?.month ?? 0);
  const [day, setDay] = useState(initial?.day ?? 0);
  const maxDay = month ? daysInMonth(month) : 31;
  const valid = month > 0 && day > 0 && day <= maxDay;
  const selectClass =
    "min-h-14 w-full rounded-xl border border-line bg-surface-2 px-3 text-2xl font-bold text-ink focus:border-gold focus:outline-none";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <div className="mb-6 flex justify-center">
          <ModeBadge demo={demo} />
        </div>
        <p className="text-xs font-bold tracking-[0.4em] text-gold">BIRTHDAY DUEL</p>
        <h1 className="mt-2 text-3xl font-bold tracking-wide">バースデー・デュエル</h1>
        <p className="mt-4 text-lg leading-relaxed">
          同じ誕生日の有名人で、<span className="text-gold">知名度勝負</span>。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          誕生日（月日）を入れると、その日に生まれた人物があなたの手札になります。生まれ年や名前は不要です。
        </p>
      </header>

      <form
        className="rounded-2xl border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit({ month, day });
        }}
      >
        <fieldset>
          <legend className="mb-3 text-sm font-bold tracking-wide text-ink-soft">あなたの誕生日</legend>
          <div className="flex items-center gap-2 text-lg">
            <label className="flex flex-1 items-center gap-2">
              <select
                aria-label="月"
                value={month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMonth(m);
                  if (day > daysInMonth(m)) setDay(0);
                }}
                className={selectClass}
              >
                <option value={0}>--</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              月
            </label>
            <label className="flex flex-1 items-center gap-2">
              <select aria-label="日" value={day} onChange={(e) => setDay(Number(e.target.value))} className={selectClass}>
                <option value={0}>--</option>
                {Array.from({ length: maxDay }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              日
            </label>
          </div>
          {month === 2 && <p className="mt-2 text-sm text-ink-soft">2月29日も選べます。</p>}
        </fieldset>
        <BigButton className="mt-5" disabled={!valid} onClick={() => valid && onSubmit({ month, day })}>
          手札を見る
        </BigButton>
        {onCancel && (
          <BigButton className="mt-3" variant="secondary" onClick={onCancel}>
            戻る
          </BigButton>
        )}
      </form>

      <section className="rounded-2xl border border-line p-4 text-sm leading-relaxed text-ink-soft">
        <h2 className="mb-2 text-xs font-bold tracking-[0.3em] text-gold">HOUSE RULES</h2>
        <ol className="list-decimal space-y-1 pl-5 marker:text-gold">
          <li>お題のカテゴリーを決める（例: 「次は音楽」）</li>
          <li>各自、手札から 1 枚選んで伏せる</li>
          <li>「せーの」で一斉に公開</li>
          <li>知名度スコア（Wikipedia の閲覧数）が一番高い人の勝ち</li>
        </ol>
        <p className="mt-2">負けた人の罰ゲームは、その場で決めてください。</p>
        <p className="mt-2 text-xs">誕生日はこの端末にだけ保存されます。1 台を回して使うときは、手札画面の「誕生日を変える」で切り替えられます。</p>
      </section>

      <label className="flex min-h-12 items-start gap-3 rounded-2xl border border-dashed border-line p-4 text-sm">
        <input
          type="checkbox"
          checked={demo}
          onChange={(e) => onToggleDemo(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-gold"
        />
        <span>
          <span className="block font-bold">デモモードで試す</span>
          <span className="block text-ink-soft">
            架空の人物とデモ値で操作を確認できます。
            {demo && ` デモデータがある誕生日: ${DEMO_BIRTHDAYS.map((b) => `${b.month}月${b.day}日`).join("・")}`}
          </span>
        </span>
      </label>
    </main>
  );
}
