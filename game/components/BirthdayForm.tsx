"use client";

import { useState } from "react";
import { daysInMonth, type Birthday } from "@/lib/birthday";
import { DEMO_BIRTHDAYS, getDemoHand } from "@/lib/demo";
import type { Person } from "@/lib/types";
import { CardVisual, CategoryLabel, GhostButton, LimeButton, Signature, TopBar } from "./ui";

// 1 枚目の画面に飾る見本のカード（デモ用の架空の人物）
const SAMPLE = ["D1029-6", "D1029-1", "D1029-3"].flatMap((id) =>
  (getDemoHand(10, 29)?.people ?? []).filter((p) => p.id === id),
);

export default function BirthdayForm({
  initial,
  demo,
  onSubmit,
  onToggleDemo,
  onCancel,
  onMenu,
}: {
  initial: Birthday | null;
  demo: boolean;
  onSubmit: (b: Birthday) => void;
  onToggleDemo: (on: boolean) => void;
  onCancel?: () => void;
  onMenu: () => void;
}) {
  const [month, setMonth] = useState(initial?.month ?? 0);
  const [day, setDay] = useState(initial?.day ?? 0);
  const [rulesOpen, setRulesOpen] = useState(false);
  const maxDay = month ? daysInMonth(month) : 31;
  const valid = month > 0 && day > 0 && day <= maxDay;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-5 pt-3 pb-8">
      {/* 右下へ走るライムの帯 */}
      <span aria-hidden className="lime-slash pointer-events-none absolute top-52 -right-24 h-80 w-80 opacity-80" />

      <TopBar demo={demo} onBack={onCancel} logo="md" onMenu={onMenu} />

      <h1 className="relative mt-6 text-[2.6rem] leading-[1.15] font-black">
        <span className="slant">誕生日が、</span>
        <br />
        <span className="slant">切り札になる。</span>
      </h1>
      <p className="relative mt-3 -rotate-3 text-sm font-bold text-ink-soft">
        同じ誕生日の有名人が、あなたの手札に。
        <br />
        知名度で勝負しよう。
      </p>

      <div aria-hidden className="relative mx-auto mt-6 h-52 w-full max-w-sm">
        {SAMPLE.map((p, i) => (
          <FanCard key={p.id} person={p} index={i} />
        ))}
      </div>

      <form
        className="relative mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit({ month, day });
        }}
      >
        <p className="text-sm font-bold text-ink-soft">まずは、あなたの誕生日を教えてください。</p>
        <div className="mt-3 flex gap-3">
          <DateSelect label="月" value={month} max={12} onChange={(m) => {
            setMonth(m);
            if (day > daysInMonth(m)) setDay(0);
          }} />
          <DateSelect label="日" value={day} max={maxDay} onChange={setDay} />
        </div>
        {month === 2 && <p className="mt-2 text-xs text-ink-soft">2月29日も選べます。</p>}
        <LimeButton className="mt-5" disabled={!valid} onClick={() => valid && onSubmit({ month, day })}>
          手札を見る
        </LimeButton>
      </form>

      <button
        type="button"
        onClick={() => setRulesOpen(true)}
        className="relative mx-auto mt-4 flex min-h-11 items-center gap-2 text-sm font-bold"
      >
        <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-ink-soft text-xs text-white">
          ?
        </span>
        遊び方
      </button>

      {rulesOpen && <RulesSheet demo={demo} onToggleDemo={onToggleDemo} onClose={() => setRulesOpen(false)} />}
    </main>
  );
}

function DateSelect({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="relative flex min-h-16 flex-1 items-center rounded-2xl bg-surface px-4 shadow-sm">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none bg-transparent font-display text-4xl outline-none"
      >
        <option value={0}>--</option>
        {Array.from({ length: max }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute left-16 text-sm font-bold">
        {label}
      </span>
      <span aria-hidden className="pointer-events-none absolute right-4 text-ink-soft">
        ⌄
      </span>
    </label>
  );
}

function FanCard({ person, index }: { person: Person; index: number }) {
  const pos = [
    "left-0 top-6 -rotate-8 w-[34%]",
    "left-1/2 -translate-x-1/2 top-0 rotate-2 z-10 w-[40%]",
    "right-0 top-6 rotate-8 w-[34%]",
  ][index];
  return (
    <div className={`absolute overflow-hidden rounded-xl bg-surface p-1.5 shadow-lg ${pos}`}>
      <div className="relative">
        <CardVisual person={person} className="aspect-[3/4] w-full rounded-lg" />
        <span className="absolute top-1 right-1 rounded bg-black/70 px-1 text-[0.55rem] font-bold text-white">
          DEMO
        </span>
        {index === 1 && <Signature name={person.nameRoman} className="bottom-3 left-2 text-2xl" />}
      </div>
      <p className="mt-1 truncate text-xs font-black">{person.name}</p>
      {person.categories[0] && <CategoryLabel id={person.categories[0]} />}
    </div>
  );
}

function RulesSheet({
  demo,
  onToggleDemo,
  onClose,
}: {
  demo: boolean;
  onToggleDemo: (on: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="遊び方"
        onClick={(e) => e.stopPropagation()}
        className="sheet-up w-full max-w-md rounded-t-3xl bg-surface p-6 sm:rounded-3xl"
      >
        <h2 className="text-2xl font-black">
          <span className="slant lime-mark">遊び方</span>
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>それぞれのスマホで、自分の誕生日を入れる</li>
          <li>お題のカテゴリーを決める（例: 「次は音楽」）</li>
          <li>手札から 1 枚選んで、伏せて待つ</li>
          <li>「せーの」で一斉に公開</li>
          <li>知名度スコア（日本語版 Wikipedia の閲覧数）が一番高い人の勝ち</li>
        </ol>
        <p className="mt-3 text-sm text-ink-soft">負けた人の罰ゲームは、その場で決めてください。誕生日はこの端末にだけ保存されます。</p>

        <label className="mt-5 flex min-h-12 items-start gap-3 rounded-2xl bg-paper p-4 text-sm">
          <input
            type="checkbox"
            checked={demo}
            onChange={(e) => onToggleDemo(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-ink"
          />
          <span>
            <span className="block font-bold">デモモードで試す</span>
            <span className="block text-ink-soft">
              架空の人物とデモ値で操作を確認できます（デモデータがある誕生日:{" "}
              {DEMO_BIRTHDAYS.map((b) => `${b.month}月${b.day}日`).join("・")}）
            </span>
          </span>
        </label>
        <GhostButton className="mt-4" onClick={onClose}>
          閉じる
        </GhostButton>
      </div>
    </div>
  );
}
