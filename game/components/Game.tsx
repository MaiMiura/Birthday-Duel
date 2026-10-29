"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { birthdayKey, formatBirthday, type Birthday } from "@/lib/birthday";
import { CATEGORIES } from "@/lib/categories";
import { DEMO_BIRTHDAYS, getDemoHand } from "@/lib/demo";
import { selectCard, visiblePeople } from "@/lib/game";
import {
  DEFAULT_SETTINGS,
  loadBirthday,
  loadDemo,
  loadSelection,
  loadSettings,
  saveBirthday,
  saveDemo,
  saveSelection,
  saveSettings,
  type SelectionState,
  type Settings,
} from "@/lib/storage";
import type { CategoryId, Hand, Person } from "@/lib/types";
import BirthdayForm from "./BirthdayForm";
import DuelView from "./DuelView";
import HandView, { type Tab } from "./HandView";
import SettingsView from "./SettingsView";
import { BigButton, ModeBadge } from "./ui";

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; hand: Hand }
  | { status: "error"; kind: "timeout" | "upstream" | "network"; message: string; detail?: string }
  | { status: "no-demo" };

type Screen = "birthday" | "hand" | "duel" | "settings";

// サーバーは最大 300 秒まで待つ設定だが、子どもが待てる長さで打ち切って再試行を案内する
const CLIENT_TIMEOUT_MS = 150_000;

async function fetchLiveHand(b: Birthday, retry: boolean): Promise<Hand> {
  const res = await fetch(`/api/hand?date=${birthdayKey(b)}${retry ? "&retry=1" : ""}`, {
    signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.hand) {
    const err = new Error(body?.error ?? `HTTP ${res.status}`) as Error & { kind?: string; detail?: string };
    err.kind = body?.kind;
    err.detail = body?.detail;
    throw err;
  }
  return body.hand as Hand;
}

function firstTab(hand: Hand, settings: Settings): Tab {
  return CATEGORIES.find((c) => visiblePeople(hand, c.id, settings).length > 0)?.id ?? "entertainment";
}

export default function Game() {
  const [mounted, setMounted] = useState(false);
  const [birthday, setBirthday] = useState<Birthday | null>(null);
  const [demo, setDemo] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [screen, setScreen] = useState<Screen>("birthday");
  const [load, setLoad] = useState<Load>({ status: "idle" });
  const [tab, setTab] = useState<Tab>("entertainment");
  const [detail, setDetail] = useState<Person | null>(null);
  const [retrying, setRetrying] = useState(false);
  const requestId = useRef(0);

  const loadHand = useCallback(
    async (b: Birthday, isDemo: boolean, s: Settings, keepTab?: Tab) => {
      const id = ++requestId.current;
      if (isDemo) {
        const hand = getDemoHand(b.month, b.day);
        if (!hand) return setLoad({ status: "no-demo" });
        setLoad({ status: "ready", hand });
        setTab(keepTab ?? firstTab(hand, s));
        return;
      }
      setLoad({ status: "loading" });
      try {
        const hand = await fetchLiveHand(b, false);
        if (id !== requestId.current) return;
        setLoad({ status: "ready", hand });
        setTab(keepTab ?? firstTab(hand, s));
      } catch (e) {
        if (id !== requestId.current) return;
        const err = e as Error & { kind?: string; detail?: string };
        const timeout = err.name === "TimeoutError" || err.kind === "timeout";
        setLoad({
          status: "error",
          kind: timeout ? "timeout" : err.kind === "upstream" ? "upstream" : "network",
          message: timeout ? "時間がかかりすぎたため、取得を打ち切りました。" : err.message,
          detail: err.detail,
        });
      }
    },
    [],
  );

  // 端末に保存した誕生日・設定・選択中のカードを読み込む
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isDemo = params.get("demo") === "1" ? true : params.get("demo") === "0" ? false : loadDemo();
    saveDemo(isDemo);
    const s = loadSettings();
    const b = loadBirthday();
    const sel = loadSelection();
    // 保存されたカードのモードが今と違えば捨てる（デモと実データを混ぜない）
    const validSel = sel && sel.card.mode === (isDemo ? "demo" : "live") ? sel : null;
    if (!validSel) saveSelection(null);
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage はマウント後にしか読めない */
    setDemo(isDemo);
    setSettings(s);
    setBirthday(b);
    setSelection(validSel);
    setScreen(validSel ? "duel" : b ? "hand" : "birthday");
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (b) void loadHand(b, isDemo, s, validSel?.card.category);
  }, [loadHand]);

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const clearSelection = () => {
    setSelection(null);
    saveSelection(null);
  };

  const changeDemo = (on: boolean) => {
    setDemo(on);
    saveDemo(on);
    clearSelection();
    if (birthday) void loadHand(birthday, on, settings);
  };

  const submitBirthday = (b: Birthday) => {
    setBirthday(b);
    saveBirthday(b);
    clearSelection();
    setDetail(null);
    setScreen("hand");
    void loadHand(b, demo, settings);
  };

  const choose = (person: Person, category: CategoryId) => {
    if (load.status !== "ready") return;
    const sel = { card: selectCard(load.hand, person, category), revealed: false };
    setSelection(sel);
    saveSelection(sel);
    setDetail(null);
    setScreen("duel");
    window.scrollTo(0, 0);
  };

  const backToHand = (category?: CategoryId) => {
    clearSelection();
    if (category) setTab(category);
    setScreen("hand");
    window.scrollTo(0, 0);
  };

  const retryScores = async () => {
    if (!birthday || demo) return;
    setRetrying(true);
    try {
      const hand = await fetchLiveHand(birthday, true);
      setLoad({ status: "ready", hand });
    } catch {
      // 失敗したままの表示を残す（もう一度押せる）
    } finally {
      setRetrying(false);
    }
  };

  /** 実データが取れないときなどに、利用者の操作でデモモードへ切り替える */
  const tryDemo = (b?: Birthday) => {
    setDemo(true);
    saveDemo(true);
    clearSelection();
    if (b) {
      setBirthday(b);
      saveBirthday(b);
    }
    const target = b ?? birthday;
    if (target) void loadHand(target, true, settings);
  };

  if (!mounted) {
    return <main className="flex min-h-dvh items-center justify-center text-ink-soft">よみこみ中…</main>;
  }

  let view: React.ReactNode;
  if (screen === "birthday" || !birthday) {
    view = (
      <BirthdayForm
        initial={birthday}
        demo={demo}
        onSubmit={submitBirthday}
        onToggleDemo={changeDemo}
        onCancel={birthday ? () => setScreen("hand") : undefined}
      />
    );
  } else if (screen === "settings") {
    view = (
      <SettingsView
        settings={settings}
        demo={demo}
        onChange={updateSettings}
        onToggleDemo={changeDemo}
        onResetBirthday={() => {
          saveBirthday(null);
          setBirthday(null);
          clearSelection();
          setLoad({ status: "idle" });
          setScreen("birthday");
        }}
        onBack={() => setScreen("hand")}
      />
    );
  } else if (screen === "duel" && selection) {
    view = (
      <DuelView
        card={selection.card}
        revealed={selection.revealed}
        onReveal={() => {
          const sel = { ...selection, revealed: true };
          setSelection(sel);
          saveSelection(sel);
        }}
        onReselect={() => backToHand(selection.card.category)}
        onNext={() => backToHand(selection.card.category)}
      />
    );
  } else if (load.status === "ready") {
    view = (
      <HandView
        hand={load.hand}
        tab={tab}
        settings={settings}
        detail={detail}
        retrying={retrying}
        onTab={(t) => {
          setTab(t);
          setDetail(null);
        }}
        onOpen={setDetail}
        onClose={() => setDetail(null)}
        onChoose={choose}
        onHide={(p) => {
          updateSettings({
            ...settings,
            hiddenIds: [...settings.hiddenIds, p.id],
            hiddenNames: { ...settings.hiddenNames, [p.id]: p.name },
          });
          setDetail(null);
        }}
        onChangeBirthday={() => setScreen("birthday")}
        onSettings={() => setScreen("settings")}
        onRetryScores={retryScores}
      />
    );
  } else {
    view = (
      <StatusScreen
        load={load}
        birthday={birthday}
        demo={demo}
        onRetry={() => loadHand(birthday, demo, settings)}
        onChangeBirthday={() => setScreen("birthday")}
        onDemo={tryDemo}
      />
    );
  }

  return <div data-reduce-motion={settings.reduceMotion}>{view}</div>;
}

function StatusScreen({
  load,
  birthday,
  demo,
  onRetry,
  onChangeBirthday,
  onDemo,
}: {
  load: Load;
  birthday: Birthday;
  demo: boolean;
  onRetry: () => void;
  onChangeBirthday: () => void;
  onDemo: (b?: Birthday) => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4 py-8 text-center">
      <div className="flex justify-center">
        <ModeBadge demo={demo} />
      </div>
      <p className="text-lg font-bold">{formatBirthday(birthday)}生まれ</p>

      {(load.status === "loading" || load.status === "idle") && (
        <div role="status" className="space-y-3">
          <p className="animate-bounce text-6xl" aria-hidden>
            🃏
          </p>
          <p className="text-2xl font-black">手札をあつめています…</p>
          <p className="text-ink-soft">
            Wikidata と Wikipedia から人物と閲覧数を集めています。この誕生日を初めて開くときは 1 分ほどかかることがあります。
          </p>
        </div>
      )}

      {load.status === "error" && (
        <div role="alert" className="space-y-3">
          <p className="text-6xl" aria-hidden>
            {load.kind === "timeout" ? "⏰" : "📡"}
          </p>
          <p className="text-2xl font-black">
            {load.kind === "timeout" ? "時間切れになりました" : "人物データを取得できませんでした"}
          </p>
          <p>{load.message}</p>
          {load.detail && <p className="text-xs break-all text-ink-soft">詳細: {load.detail}</p>}
          <p className="text-sm text-ink-soft">
            少し待ってから再試行してください。デモモードには自動で切り替わりません。
          </p>
          <BigButton onClick={onRetry}>再試行</BigButton>
          <BigButton variant="secondary" onClick={() => onDemo()}>
            デモモードで試す
          </BigButton>
        </div>
      )}

      {load.status === "no-demo" && (
        <div className="space-y-3">
          <p className="text-2xl font-black">この誕生日のデモデータはありません</p>
          <p className="text-ink-soft">デモモードでは、次の誕生日で試せます。</p>
          {DEMO_BIRTHDAYS.map((b) => (
            <BigButton key={birthdayKey(b)} variant="secondary" onClick={() => onDemo(b)}>
              {formatBirthday(b)}で試す
            </BigButton>
          ))}
        </div>
      )}

      <BigButton variant="secondary" onClick={onChangeBirthday}>
        誕生日を変える
      </BigButton>
    </main>
  );
}
