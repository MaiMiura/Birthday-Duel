// カードの見た目に使う小さな部品。

import { categoryRule } from "@/lib/categories";
import type { CategoryId, Person } from "@/lib/types";

export const CATEGORY_STYLE: Record<CategoryId, { bg: string; text: string; border: string; soft: string }> = {
  entertainment: { bg: "bg-cat-entertainment", text: "text-cat-entertainment", border: "border-cat-entertainment", soft: "bg-pink-50" },
  music: { bg: "bg-cat-music", text: "text-cat-music", border: "border-cat-music", soft: "bg-violet-50" },
  sports: { bg: "bg-cat-sports", text: "text-cat-sports", border: "border-cat-sports", soft: "bg-sky-50" },
  knowledge: { bg: "bg-cat-knowledge", text: "text-cat-knowledge", border: "border-cat-knowledge", soft: "bg-amber-50" },
  history: { bg: "bg-cat-history", text: "text-cat-history", border: "border-cat-history", soft: "bg-green-50" },
};

export function CategoryBadge({ id, size = "sm" }: { id: CategoryId; size?: "sm" | "lg" }) {
  const rule = categoryRule(id);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold text-white ${CATEGORY_STYLE[id].bg} ${
        size === "lg" ? "px-4 py-1.5 text-lg" : "px-2 py-0.5 text-xs"
      }`}
    >
      <span aria-hidden>{rule.emoji}</span>
      {rule.label}
    </span>
  );
}

/** 人物画像。使える画像がなければ、頭文字とカテゴリーの絵文字の代替ビジュアル。 */
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
        cat ? CATEGORY_STYLE[cat].bg : "bg-stone-400"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute -right-2 -bottom-3 opacity-25 ${large ? "text-[9rem]" : "text-6xl"}`}
      >
        {cat ? categoryRule(cat).emoji : "★"}
      </span>
      <span
        aria-hidden
        className={`relative font-black text-white drop-shadow ${large ? "text-[7rem]" : "text-5xl"}`}
      >
        {initial}
      </span>
    </div>
  );
}

export function ModeBadge({ demo }: { demo: boolean }) {
  return demo ? (
    <span className="rounded-md border-2 border-dashed border-amber-600 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
      🧪 デモモード
    </span>
  ) : (
    <span className="rounded-md border border-emerald-700 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-900">
      🌐 実データ
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
    primary: "bg-brand text-white shadow-[0_4px_0_var(--color-brand-dark)] active:translate-y-1 active:shadow-none",
    secondary: "bg-white text-ink border-2 border-stone-300 active:bg-stone-100",
    reveal:
      "bg-brand text-white text-3xl py-6 shadow-[0_6px_0_var(--color-brand-dark)] active:translate-y-1.5 active:shadow-none",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-14 w-full rounded-2xl px-5 py-3 text-lg font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
