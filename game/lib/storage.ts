// 端末内の保存（localStorage）。プライベートモードなどで使えなくても動くようにする。

import type { Birthday } from "./birthday";
import { isValidBirthday } from "./birthday";
import type { SelectedCard } from "./types";

const KEYS = {
  birthday: "bduel:birthday",
  demo: "bduel:demo",
  settings: "bduel:settings",
  selected: "bduel:selected",
} as const;

export interface Settings {
  kidsFilter: boolean;
  reduceMotion: boolean;
  hiddenIds: string[];
  /** 外したカードの名前（設定画面で戻すときに表示する） */
  hiddenNames: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
  kidsFilter: true,
  reduceMotion: false,
  hiddenIds: [],
  hiddenNames: {},
};

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できなくても、この画面を開いている間は使える
  }
}

export function loadBirthday(): Birthday | null {
  const b = read<Birthday>(KEYS.birthday);
  return b && isValidBirthday(b.month, b.day) ? b : null;
}
export const saveBirthday = (b: Birthday | null) => write(KEYS.birthday, b);

export const loadDemo = () => read<boolean>(KEYS.demo) === true;
export const saveDemo = (on: boolean) => write(KEYS.demo, on ? true : null);

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(KEYS.settings) ?? {}) };
}
export const saveSettings = (s: Settings) => write(KEYS.settings, s);

export interface SelectionState {
  card: SelectedCard;
  revealed: boolean;
}
export const loadSelection = () => read<SelectionState>(KEYS.selected);
export const saveSelection = (s: SelectionState | null) => write(KEYS.selected, s);
