"use client";

import type { Settings } from "@/lib/storage";
import { BigButton, ModeBadge } from "./ui";

export default function SettingsView({
  settings,
  demo,
  onChange,
  onToggleDemo,
  onResetBirthday,
  onBack,
}: {
  settings: Settings;
  demo: boolean;
  onChange: (s: Settings) => void;
  onToggleDemo: (on: boolean) => void;
  onResetBirthday: () => void;
  onBack: () => void;
}) {
  const restore = (id: string) => {
    const hiddenNames = { ...settings.hiddenNames };
    delete hiddenNames[id];
    onChange({ ...settings, hiddenIds: settings.hiddenIds.filter((h) => h !== id), hiddenNames });
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">設定</h1>
        <ModeBadge demo={demo} />
      </div>

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
      <Toggle
        checked={demo}
        onChange={onToggleDemo}
        title="デモモード"
        description="架空の人物とデモ値で操作を試します。実データとは別物です"
      />

      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="font-bold">外したカード（{settings.hiddenIds.length}）</h2>
        {settings.hiddenIds.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">ありません。カードの詳細画面の「このカードを外す」で外せます。</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {settings.hiddenIds.map((id) => (
              <li key={id} className="flex items-center justify-between gap-2">
                <span>{settings.hiddenNames[id] ?? id}</span>
                <button
                  type="button"
                  onClick={() => restore(id)}
                  className="min-h-11 rounded-lg border border-line px-3 text-sm font-bold"
                >
                  戻す
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BigButton variant="secondary" onClick={onResetBirthday}>
        誕生日をリセット
      </BigButton>
      <BigButton onClick={onBack}>手札に戻る</BigButton>
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
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-gold"
      />
      <span>
        <span className="block font-bold">
          {title}：{checked ? "オン" : "オフ"}
        </span>
        <span className="block text-sm text-ink-soft">{description}</span>
      </span>
    </label>
  );
}
