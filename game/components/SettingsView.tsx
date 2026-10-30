"use client";

import type { Settings } from "@/lib/storage";
import { GhostButton, LimeButton, TopBar } from "./ui";

export default function SettingsView({
  settings,
  demo,
  hasBirthday,
  onChange,
  onResetBirthday,
  onBack,
  onShare,
}: {
  settings: Settings;
  demo: boolean;
  hasBirthday: boolean;
  onChange: (s: Settings) => void;
  onResetBirthday: () => void;
  onBack: () => void;
  onShare: () => void;
}) {
  const restore = (id: string) => {
    const hiddenNames = { ...settings.hiddenNames };
    delete hiddenNames[id];
    onChange({ ...settings, hiddenIds: settings.hiddenIds.filter((h) => h !== id), hiddenNames });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-3 pb-8">
      <TopBar demo={demo} onBack={onBack} />
      <h1 className="text-3xl font-black">
        <span className="slant lime-mark px-1">設定</span>
      </h1>

      <Toggle
        checked={settings.kidsFilter}
        onChange={(v) => onChange({ ...settings, kidsFilter: v })}
        title="センシティブな人物を隠す"
        description="アダルト作品への出演や犯罪の記録がある人物を手札に出しません（Wikidata の職業と説明で判定。完全ではありません）"
      />
      <Toggle
        checked={settings.reduceMotion}
        onChange={(v) => onChange({ ...settings, reduceMotion: v })}
        title="アニメーションを減らす"
        description="カードをめくる演出などを止めます（端末の「視差効果を減らす」設定にも従います）"
      />

      <section className="rounded-2xl bg-surface p-4 shadow-sm">
        <h2 className="font-black">外したカード（{settings.hiddenIds.length}）</h2>
        {settings.hiddenIds.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">ありません。カードの詳細（i）の「このカードを外す」で外せます。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {settings.hiddenIds.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2">
                <span>{settings.hiddenNames[id] ?? id}</span>
                <button
                  type="button"
                  onClick={() => restore(id)}
                  className="min-h-11 rounded-full border border-line px-4 text-sm font-bold"
                >
                  戻す
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <GhostButton onClick={onShare}>みんなを招待（QRコード）</GhostButton>
      {hasBirthday && <GhostButton onClick={onResetBirthday}>誕生日をリセット</GhostButton>}
      <LimeButton onClick={onBack} arrow={false}>
        戻る
      </LimeButton>
    </main>
  );
}

function Toggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4 shadow-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-ink"
      />
      <span>
        <span className="block font-black">
          {title}：{checked ? "オン" : "オフ"}
        </span>
        <span className="block text-sm text-ink-soft">{description}</span>
      </span>
    </label>
  );
}
