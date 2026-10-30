"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { GhostButton, LimeButton } from "./ui";

/** アプリの URL（デモ用の ?demo=1 などは付けない） */
export function appUrl(): string {
  return `${window.location.origin}/`;
}

/** 友だちにアプリを開いてもらうための QR コードとリンク */
export default function ShareSheet({ onClose }: { onClose: () => void }) {
  const [url] = useState(appUrl);
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [url, onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // コピーできない端末では、表示している URL を長押しでコピーしてもらう
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="アプリを共有"
        onClick={(e) => e.stopPropagation()}
        className="sheet-up w-full max-w-md rounded-t-3xl bg-surface p-6 text-center sm:rounded-3xl"
      >
        <h2 className="text-2xl font-black">
          <span className="slant lime-mark px-1">みんなを招待</span>
        </h2>
        <p className="mt-2 text-sm text-ink-soft">このQRコードを読み取ると、アプリが開きます。</p>

        <div className="mx-auto mt-4 w-64 max-w-full rounded-2xl border-4 border-lime bg-white p-3">
          {svg ? (
            // QR コードのライブラリが作った SVG をそのまま表示する
            <div role="img" aria-label={`${url} のQRコード`} dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="flex aspect-square items-center justify-center text-sm text-ink-soft">QRコードを作っています…</div>
          )}
        </div>
        <p className="mt-3 text-sm font-bold break-all select-all">{url}</p>

        <div className="mt-5 space-y-2">
          {canShare && (
            <LimeButton onClick={() => navigator.share({ title: "バースデー・デュエル", url }).catch(() => {})}>
              LINE などで送る
            </LimeButton>
          )}
          <GhostButton onClick={copy}>{copied ? "コピーしました" : "リンクをコピー"}</GhostButton>
          <button type="button" onClick={onClose} className="min-h-12 w-full text-sm font-bold text-ink-soft underline">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
