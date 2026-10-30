"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { birthdayKey, formatBirthday, type Birthday } from "@/lib/birthday";
import { CATEGORIES } from "@/lib/categories";
import { scorePeriod } from "@/lib/period";
import { DEMO_BIRTHDAYS, getDemoHand } from "@/lib/demo";
import { selectCard, visiblePeople, type FetchedScore } from "@/lib/game";
import {
  clearLegacyDemo,
  DEFAULT_SETTINGS,
  loadBirthday,
  loadSelection,
  loadSettings,
  saveBirthday,
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
import ShareSheet from "./ShareSheet";
import { GhostButton, LimeButton, TopBar } from "./ui";

type Load =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; hand: Hand }
  | { status: "error"; kind: "timeout" | "upstream" | "network"; message: string; detail?: string }
  | { status: "no-demo" };

type Screen = "birthday" | "hand" | "duel" | "settings";

// サーバーは最大 300 秒まで待つ設定だが、その場で待てる長さで打ち切って再試行を案内する
const CLIENT_TIMEOUT_MS = 150_000;

/**
 * 前もって作った手札（public/hands/<月-日>.json、GitHub Actions で作って配っている）。
 * なければ null（その場で作る）。集計期間は、読んだ時点のものにそろえる。
 */
async function fetchPrebuiltHand(b: Birthday): Promise<Hand | null> {
  try {
    const res = await fetch(`/hands/${birthdayKey(b)}.json`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const hand = (await res.json()) as Hand;
    return Array.isArray(hand.people) ? { ...hand, period: scorePeriod() } : null;
  } catch {
    return null;
  }
}

async function fetchLiveHand(b: Birthday, retry: boolean): Promise<Hand> {
  if (!retry) {
    const prebuilt = await fetchPrebuiltHand(b);
    if (prebuilt) return prebuilt;
  }
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
  // 公開画面から「次は〇〇で勝負」で戻ってきたときのお題（手札画面に案内を出す）
  const [roundCategory, setRoundCategory] = useState<CategoryId | null>(null);
  // 「このカードで勝負」を押してから、その人のスコアを取り終えるまで
  const [choosing, setChoosing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const openShare = () => setShareOpen(true);
  const [chooseError, setChooseError] = useState<string | null>(null);
  // 設定画面を閉じたときに戻る画面
  const [settingsFrom, setSettingsFrom] = useState<Screen>("hand");
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
    // デモモード（架空の人物）は開発・確認用。URL に ?demo=1 を付けたときだけ使い、端末には保存しない
    const isDemo = params.get("demo") === "1";
    clearLegacyDemo();
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

  const submitBirthday = (b: Birthday) => {
    setBirthday(b);
    saveBirthday(b);
    clearSelection();
    setDetail(null);
    setScreen("hand");
    void loadHand(b, demo, settings);
  };

  const choose = async (person: Person, category: CategoryId) => {
    if (load.status !== "ready" || choosing) return;
    const hand = load.hand;
    let fetched: FetchedScore | undefined;
    if (person.score.status === "pending") {
      // 閲覧数は、選んだこの 1 人分だけ、ここで取る
      setChoosing(true);
      setChooseError(null);
      try {
        const res = await fetch(`/api/score?title=${encodeURIComponent(person.jaTitle ?? "")}`, {
          signal: AbortSignal.timeout(30_000),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || typeof body?.views !== "number") throw new Error(body?.error ?? `HTTP ${res.status}`);
        fetched = body as FetchedScore;
      } catch {
        setChooseError(`「${person.name}」のスコアを取得できませんでした。もう一度押すか、別のカードを選んでください。`);
        setDetail(null);
        return;
      } finally {
        setChoosing(false);
      }
    }
    const sel = { card: selectCard(hand, person, category, new Date(), fetched), revealed: false };
    setChooseError(null);
    setSelection(sel);
    saveSelection(sel);
    setDetail(null);
    setScreen("duel");
    window.scrollTo(0, 0);
  };

  const backToHand = (category?: CategoryId, nextRound = false) => {
    clearSelection();
    if (category) setTab(category);
    setRoundCategory(nextRound && category ? category : null);
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

  /** デモモードで、デモデータのある誕生日に切り替える（開発・確認用） */
  const tryDemo = (b: Birthday) => {
    clearSelection();
    setBirthday(b);
    saveBirthday(b);
    void loadHand(b, true, settings);
  };

  if (!mounted) {
    return <main className="flex min-h-dvh items-center justify-center text-ink-soft">読み込み中…</main>;
  }

  let view: React.ReactNode;
  if (screen === "settings") {
    view = (
      <SettingsView
        settings={settings}
        demo={demo}
        hasBirthday={birthday !== null}
        onChange={updateSettings}
        onResetBirthday={() => {
          saveBirthday(null);
          setBirthday(null);
          clearSelection();
          setLoad({ status: "idle" });
          setScreen("birthday");
        }}
        onBack={() => setScreen(birthday ? settingsFrom : "birthday")}
        onShare={openShare}
      />
    );
  } else if (screen === "birthday" || !birthday) {
    view = (
      <BirthdayForm
        initial={birthday}
        demo={demo}
        onSubmit={submitBirthday}
        onCancel={birthday ? () => setScreen("hand") : undefined}
        onMenu={() => {
          setSettingsFrom("birthday");
          setScreen("settings");
        }}
        onShare={openShare}
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
        onNext={(c) => backToHand(c, c !== selection.card.category)}
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
        roundCategory={roundCategory}
        onTab={(t) => {
          setTab(t);
          setChooseError(null);
          setRoundCategory(null);
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
        onSettings={() => {
          setSettingsFrom("hand");
          setScreen("settings");
        }}
        onRetryScores={retryScores}
        onShare={openShare}
        choosing={choosing}
        chooseError={chooseError}
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
        onMenu={() => {
          setSettingsFrom("hand");
          setScreen("settings");
        }}
      />
    );
  }

  return (
    <div data-reduce-motion={settings.reduceMotion}>
      {view}
      {shareOpen && <ShareSheet onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function StatusScreen({
  load,
  birthday,
  demo,
  onRetry,
  onChangeBirthday,
  onDemo,
  onMenu,
}: {
  load: Load;
  birthday: Birthday;
  demo: boolean;
  onRetry: () => void;
  onChangeBirthday: () => void;
  onDemo: (b: Birthday) => void;
  onMenu: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-3 pb-8">
      <TopBar demo={demo} onMenu={onMenu} />
      <div className="flex flex-1 flex-col justify-center gap-4 text-center">
        <p className="font-display text-5xl">
          <span className="slant lime-mark px-1">
            {birthday.month}
            <span className="font-sans text-2xl font-black">月</span>
            {birthday.day}
            <span className="font-sans text-2xl font-black">日</span>
          </span>
        </p>

        {(load.status === "loading" || load.status === "idle") && (
          <div role="status" className="space-y-4">
            <div aria-hidden className="mx-auto size-12 animate-spin rounded-full border-4 border-line border-t-ink" />
            <p className="text-xl font-black">手札を集めています…</p>
            <p className="text-sm text-ink-soft">
              Wikipedia と Wikidata から、この日生まれの人物を集めています。この誕生日を初めて開くときは 10 秒ほどかかります。
            </p>
          </div>
        )}

        {load.status === "error" && (
          <div role="alert" className="space-y-3">
            <p className="text-xs font-black tracking-[0.3em] text-ink-soft">{load.kind === "timeout" ? "TIMEOUT" : "ERROR"}</p>
            <p className="text-2xl font-black">
              {load.kind === "timeout" ? "時間切れになりました" : "人物データを取得できませんでした"}
            </p>
            <p className="text-sm">{load.message}</p>
            {load.detail && <p className="text-xs break-all text-ink-soft">詳細: {load.detail}</p>}
            <p className="text-xs text-ink-soft">少し待ってから再試行してください。</p>
            <LimeButton onClick={onRetry}>再試行</LimeButton>
          </div>
        )}

        {load.status === "no-demo" && (
          <div className="space-y-3">
            <p className="text-2xl font-black">この誕生日のデモデータはありません</p>
            <p className="text-sm text-ink-soft">デモモードでは、次の誕生日で試せます。</p>
            {DEMO_BIRTHDAYS.map((b) => (
              <GhostButton key={birthdayKey(b)} onClick={() => onDemo(b)}>
                {formatBirthday(b)}で試す
              </GhostButton>
            ))}
          </div>
        )}

        <button type="button" onClick={onChangeBirthday} className="min-h-11 text-sm font-bold text-ink-soft underline">
          誕生日を変える
        </button>
      </div>
    </main>
  );
}
