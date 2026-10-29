import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "バースデー・デュエル",
  description: "同じ誕生日の有名人をカードにして、その場の仲間と知名度で勝負するパーティーゲーム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#efefeb",
};

// フォントは Google Fonts から読み込む。読み込めないときは globals.css の代わりのフォントで表示される
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+JP:wght@400;500;700;900&family=Yellowtail&display=swap";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body className="paper min-h-full">{children}</body>
    </html>
  );
}
