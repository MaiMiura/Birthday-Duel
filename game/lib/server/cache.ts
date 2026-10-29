// 誕生日ごとの手札データのキャッシュ。
//
// キーは「集計期間 + 月日」。月が変わると集計期間が変わってキーも変わるので、
// 古いデータは自然に使われなくなる（＝月単位の更新）。
// 保存先: メモリ → ディスク（HAND_CACHE_DIR、既定は data/hands）。
// ディスクに書けない環境（サーバーレスなど）では OS の一時ディレクトリに書く。

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Hand } from "../types";

const PRIMARY_DIR = process.env.HAND_CACHE_DIR ?? path.join(process.cwd(), "data", "hands");
const FALLBACK_DIR = path.join(os.tmpdir(), "birthday-duel-hands");

const memory = new Map<string, Hand>();

function file(dir: string, key: string) {
  return path.join(dir, `${key}.json`);
}

export async function readCache(key: string): Promise<Hand | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  for (const dir of [PRIMARY_DIR, FALLBACK_DIR]) {
    try {
      const hand = JSON.parse(await readFile(file(dir, key), "utf8")) as Hand;
      memory.set(key, hand);
      return hand;
    } catch {
      // 無ければ次へ
    }
  }
  return null;
}

export async function writeCache(key: string, hand: Hand): Promise<void> {
  memory.set(key, hand);
  for (const dir of [PRIMARY_DIR, FALLBACK_DIR]) {
    try {
      const target = file(dir, key);
      await mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(hand));
      await rename(tmp, target);
      return;
    } catch {
      // 書けなければ次の場所へ（どこにも書けなくてもメモリには残る）
    }
  }
}

export function clearMemoryCache() {
  memory.clear();
}
