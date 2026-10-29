// 職業からカテゴリーと「子ども向けに隠すか」を決める（ネットワークを使わない純粋な処理）。

import {
  CATEGORIES,
  SENSITIVE_DESCRIPTION_WORDS,
  SENSITIVE_OCCUPATIONS,
} from "./categories";
import type { CategoryId } from "./types";

/**
 * 職業 Q-ID → その職業自身と、たどり着ける根っこ（allRootIds のうち該当するもの）。
 * Wikidata への問い合わせ結果から作る。
 */
export type AncestorMap = Map<string, Set<string>>;

function reaches(occupation: string, target: string, ancestors: AncestorMap): boolean {
  return occupation === target || (ancestors.get(occupation)?.has(target) ?? false);
}

export function classify(occupationIds: string[], ancestors: AncestorMap): CategoryId[] {
  const result: CategoryId[] = [];
  for (const rule of CATEGORIES) {
    const hit = occupationIds.some(
      (occ) =>
        rule.roots.some((root) => reaches(occ, root, ancestors)) &&
        !rule.exclude.some((ex) => reaches(occ, ex, ancestors)),
    );
    if (hit) result.push(rule.id);
  }
  return result;
}

export function sensitiveReason(
  occupationIds: string[],
  description: string | null,
  ancestors: AncestorMap,
): string | null {
  for (const s of SENSITIVE_OCCUPATIONS) {
    if (occupationIds.some((occ) => reaches(occ, s.id, ancestors))) return s.reason;
  }
  if (description) {
    for (const w of SENSITIVE_DESCRIPTION_WORDS) {
      if (w.pattern.test(description)) return w.reason;
    }
  }
  return null;
}
