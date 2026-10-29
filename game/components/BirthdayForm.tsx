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

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
      <header className="text-center">
        <div className="mb-3 flex justify-center">
          <ModeBadge demo={demo} />
        </div>
        <p className="text-5xl" aria-hidden>
          🎂🃏
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-wide">バースデー・デュエル</h1>
        <p className="mt-3 text-lg leading-relaxed">
          自分と<strong className="text-brand">同じ誕生日</strong>の人物で勝負しよう！
        </p>
        <p className="mt-1 text-sm text-ink-soft">月と日だけ入れてね。生まれた年や名前はいりません。</p>
      </header>

      <form
        className="rounded-3xl border-2 border-stone-200 bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit({ month, day });
        }}
      >
        <fieldset>
          <legend className="mb-3 text-lg font-bold">あなたの誕生日</legend>
          <div className="flex items-center gap-2 text-xl">
            <label className="flex flex-1 items-center gap-2">
              <select
                aria-label="月"
                value={month}
                onChange={(e) => {
                  const m = Number(e.target.value);
                  setMonth(m);
                  if (day > daysInMonth(m)) setDay(0);
                }}
                className="min-h-14 w-full rounded-xl border-2 border-stone-300 bg-paper px-3 text-2xl font-bold"
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
              <select
                aria-label="日"
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="min-h-14 w-full rounded-xl border-2 border-stone-300 bg-paper px-3 text-2xl font-bold"
              >
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
            もどる
          </BigButton>
        )}
      </form>

      <section className="rounded-2xl bg-white/70 p-4 text-sm leading-relaxed text-ink-soft">
        <h2 className="mb-1 font-bold text-ink">あそびかた</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>みんなで「次は音楽で勝負！」とカテゴリーを決める</li>
          <li>自分の手札から 1 枚えらんで、伏せて待つ</li>
          <li>「せーの」で公開ボタンを押して、画面を見せ合う</li>
          <li>知名度スコア（Wikipedia の閲覧数）が大きい人の勝ち！</li>
        </ol>
        <p className="mt-2">誕生日はこの端末にだけ保存されます。1 台を交代で使うときは、手札画面の「誕生日を変える」から切り替えてね。</p>
      </section>

      <section className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm">
        <label className="flex min-h-12 items-center gap-3 font-bold">
          <input
            type="checkbox"
            checked={demo}
            onChange={(e) => onToggleDemo(e.target.checked)}
            className="size-6 accent-amber-600"
          />
          デモモードで試す（架空の人物・デモ値）
        </label>
        {demo && (
          <p className="mt-1 text-amber-900">
            デモデータがある誕生日:{" "}
            {DEMO_BIRTHDAYS.map((b) => `${b.month}月${b.day}日`).join("・")}
          </p>
        )}
      </section>
    </main>
  );
}
