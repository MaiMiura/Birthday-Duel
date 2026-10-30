// 画面で共通に使う部品（ロゴ、上部のバー、ボタン、カードの絵など）。

import { categoryRule } from "@/lib/categories";
import type { CategoryId, Person } from "@/lib/types";

export const CATEGORY_TEXT: Record<CategoryId, string> = {
  entertainment: "text-cat-entertainment",
  music: "text-cat-music",
  sports: "text-cat-sports",
  knowledge: "text-cat-knowledge",
  history: "text-cat-history",
};

export const CATEGORY_BG: Record<CategoryId, string> = {
  entertainment: "bg-cat-entertainment",
  music: "bg-cat-music",
  sports: "bg-cat-sports",
  knowledge: "bg-cat-knowledge",
  history: "bg-cat-history",
};

/** 「BIRTHDAY DUEL」のロゴ（斜体の太字に、ライムの筆の線） */
export function Logo({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span className="inline-flex flex-col leading-none" aria-label="バースデー・デュエル">
      <span
        aria-hidden
        className={`slant lime-mark font-display tracking-tight uppercase ${size === "sm" ? "text-lg" : "text-[1.7rem]"}`}
      >
        Birthday
        <br />
        Duel
      </span>
      {size === "md" && (
        <span aria-hidden className="mt-1 -rotate-6 text-[0.6rem] font-bold tracking-[0.35em] text-ink-soft">
          バースデーデュエル
        </span>
      )}
    </span>
  );
}

export function DemoPill() {
  return (
    <span className="rounded-md bg-ink-soft/80 px-2 py-0.5 text-[0.7rem] font-bold tracking-wider text-white">
      DEMO
    </span>
  );
}

/** 画面上部: 左にロゴか戻るボタン、右にメニュー（デモモードのときは DEMO の印も） */
export function TopBar({
  demo,
  onBack,
  onMenu,
  center,
  logo = "sm",
}: {
  demo: boolean;
  onBack?: () => void;
  onMenu?: () => void;
  center?: React.ReactNode;
  logo?: "sm" | "md" | false;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-2">
      <div className="flex min-w-11 items-center">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="戻る" className="min-h-11 min-w-11 text-2xl">
            ‹
          </button>
        ) : logo ? (
          <Logo size={logo} />
        ) : null}
      </div>
      {center && <div className="text-center">{center}</div>}
      <div className="flex min-w-11 items-center justify-end gap-2">
        {demo && <DemoPill />}
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="メニュー"
            className="flex min-h-11 min-w-11 flex-col items-center justify-center gap-1.5"
          >
            <span className="h-0.5 w-6 bg-ink" />
            <span className="h-0.5 w-6 bg-ink" />
            <span className="h-0.5 w-6 bg-ink" />
          </button>
        )}
      </div>
    </div>
  );
}

/** ライムの丸いボタン（右に矢印） */
export function LimeButton({
  children,
  onClick,
  disabled,
  className = "",
  arrow = true,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  arrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-lime px-6 text-xl font-black tracking-wide text-ink shadow-[0_6px_18px_rgb(150_180_0/0.35)] transition active:scale-[0.98] active:bg-lime-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-soft disabled:shadow-none ${className}`}
    >
      {children}
      {arrow && <span aria-hidden>→</span>}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-14 w-full rounded-full border border-line bg-surface px-5 text-base font-bold text-ink active:bg-paper ${className}`}
    >
      {children}
    </button>
  );
}

export function CategoryLabel({ id, mark = false }: { id: CategoryId; mark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${CATEGORY_TEXT[id]}`}>
      {mark && <span aria-hidden className="inline-block size-2.5 bg-lime" />}
      {categoryRule(id).label}
    </span>
  );
}

/**
 * 人物の絵。使える写真があれば写真、なければ黒地に頭文字とライムの斜線のカード。
 */
export function CardVisual({
  person,
  className = "",
  large = false,
}: {
  person: Person;
  className?: string;
  large?: boolean;
}) {
  if (person.image) {
    return (
      // 外部（Wikimedia）の画像をそのまま表示するため next/image ではなく img を使う
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.image.url}
        alt={`${person.name}の画像`}
        className={`bg-card-black object-cover object-top ${className}`}
        loading="lazy"
      />
    );
  }
  const initial = [...person.name.replace(/\s/g, "")][0] ?? "?";
  return (
    <div
      role="img"
      aria-label={`${person.name}（画像なし）`}
      className={`card-back relative flex items-center justify-center overflow-hidden ${className}`}
    >
      <span aria-hidden className="lime-slash absolute inset-0 opacity-90" />
      <span
        aria-hidden
        className={`slant relative font-black text-white drop-shadow-[0_3px_0_rgb(0_0_0/0.6)] ${
          large ? "text-[7rem]" : "text-6xl"
        }`}
      >
        {initial}
      </span>
    </div>
  );
}

/** 写真の上に重ねる、筆記体の名前のサイン */
export function Signature({ name, className = "" }: { name: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -rotate-12 font-sign leading-none text-lime drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)] ${className}`}
    >
      {name}
    </span>
  );
}
