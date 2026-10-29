// カードの見た目に使う小さな部品。

import { categoryRule } from "@/lib/categories";
import type { CategoryId, Person } from "@/lib/types";

export const CATEGORY_STYLE: Record<CategoryId, { bg: string; text: string; border: string }> = {
  entertainment: { bg: "bg-cat-entertainment", text: "text-cat-entertainment", border: "border-cat-entertainment" },
  music: { bg: "bg-cat-music", text: "text-cat-music", border: "border-cat-music" },
  sports: { bg: "bg-cat-sports", text: "text-cat-sports", border: "border-cat-sports" },
  knowledge: { bg: "bg-cat-knowledge", text: "text-cat-knowledge", border: "border-cat-knowledge" },
  history: { bg: "bg-cat-history", text: "text-cat-history", border: "border-cat-history" },
};

export function CategoryBadge({ id }: { id: CategoryId }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tracking-wide text-white ${CATEGORY_STYLE[id].bg}`}
    >
      {categoryRule(id).label}
    </span>
  );
}

/** 人物画像。使える画像がなければ、頭文字を大きく置いた代替ビジュアル。 */
export function CardVisual({
  person,
  category,
  className = "",
  large = false,
}: {
  person: Person;
  category?: CategoryId;
  className?: string;
  large?: boolean;
}) {
  const cat = category ?? person.categories[0];
  if (person.image) {
    return (
      // 外部（Wikimedia）の画像をそのまま表示するため next/image ではなく img を使う
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.image.url}
        alt={`${person.name}の画像`}
        className={`object-cover object-top ${className}`}
        loading="lazy"
      />
    );
  }
  const initial = [...person.name.replace(/\s/g, "")][0] ?? "?";
  return (
    <div
      role="img"
      aria-label={`${person.name}（画像なし）`}
      className={`relative flex items-center justify-center overflow-hidden ${
        cat ? CATEGORY_STYLE[cat].bg : "bg-surface-2"
      } ${className}`}
    >
      {/* 斜めの光と下側の影で、単色の板に見えないようにする */}
      <span aria-hidden className="absolute inset-0 bg-linear-to-br from-white/20 via-transparent to-black/50" />
      <span
        aria-hidden
        className={`relative font-bold text-white/95 drop-shadow-[0_2px_8px_rgb(0_0_0/0.45)] ${
          large ? "text-[6.5rem]" : "text-5xl"
        }`}
      >
        {initial}
      </span>
    </div>
  );
}

export function ModeBadge({ demo }: { demo: boolean }) {
  return demo ? (
    <span className="rounded-md border border-dashed border-gold px-2 py-0.5 text-xs font-bold tracking-wide text-gold">
      DEMO・デモモード
    </span>
  ) : (
    <span className="rounded-md border border-line px-2 py-0.5 text-xs font-bold tracking-wide text-ink-soft">
      LIVE・実データ
    </span>
  );
}

export function BigButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "reveal";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-gold text-on-gold active:bg-gold-dark",
    secondary: "border border-line bg-surface text-ink active:bg-surface-2",
    reveal: "bg-gold py-6 text-2xl tracking-widest text-on-gold shadow-[0_0_32px_rgb(224_180_90/0.35)] active:bg-gold-dark",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-14 w-full rounded-xl px-5 py-3 text-lg font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
