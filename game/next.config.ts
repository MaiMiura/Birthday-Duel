import type { NextConfig } from "next";

// 開発サーバー（npm run dev）は、localhost 以外から開くとページのスクリプトを配信しない。
// 同じ Wi-Fi のスマホ（http://192.168.x.x:3000 など）から開けるよう、家庭や店の
// ネットワークで使われるプライベートアドレスを許可する。
// ほかのアドレスから開くときは ALLOWED_DEV_ORIGINS にカンマ区切りで足す。
const PRIVATE_NETWORK_ORIGINS = ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins: [
    ...PRIVATE_NETWORK_ORIGINS,
    ...(process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? []),
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
