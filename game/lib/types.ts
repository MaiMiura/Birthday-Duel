// 画面・サーバー・デモで共通に使うデータの形。

export type CategoryId = "entertainment" | "music" | "sports" | "knowledge" | "history";

export type DataMode = "live" | "demo";

/** 知名度スコアの集計期間（UTC の暦月で、start 月の初日〜end 月の末日）。 */
export interface ScorePeriod {
  /** 例: "2025-10" */
  start: string;
  /** 例: "2026-09" */
  end: string;
}

/**
 * 知名度スコアの状態。
 * - pending: まだ取っていない。「このカードで勝負」を押したときに、その 1 人分だけ取る
 * - ok: 取得できた（views が 0 のこともある。0 は「閲覧されなかった」という実際の値）
 * - failed: API への問い合わせに失敗した。値は不明なので勝負には使わない
 * - no-article: 日本語版 Wikipedia の記事がないのでスコア対象外
 * - not-fetched: どのカテゴリーにも入らないので取得していない
 */
export type Score =
  | { status: "pending" }
  | { status: "ok"; views: number; demo?: boolean }
  | { status: "failed"; reason: string }
  | { status: "no-article" }
  | { status: "not-fetched" };

export interface PersonImage {
  /** 表示用のサムネイル URL */
  url: string;
  /** Wikimedia Commons のファイルページ */
  pageUrl: string;
  /** 作者（クレジット表記） */
  artist: string;
  /** ライセンスの短い名前（例: "CC BY-SA 4.0", "Public domain"） */
  license: string;
  licenseUrl: string | null;
}

export interface Occupation {
  id: string;
  label: string;
}

export interface Person {
  /** Wikidata の Q-ID */
  id: string;
  name: string;
  /** 名前が日本語以外の言語へフォールバックしたとき、その言語コード */
  nameLang: string;
  /** ローマ字（ラテン文字）の名前。Wikidata の英語ラベルがラテン文字のときだけ。公開画面のサインに使う */
  nameRoman: string | null;
  /** Wikidata の日本語の説明。なければ null（文章を作って補わない） */
  description: string | null;
  /** 採用した生年月日（"1987-10-29"。紀元前は "-0100-10-29"） */
  birthDate: string;
  /** ユリウス暦で記録された日付をグレゴリオ暦に換算したもの */
  julian: boolean;
  occupations: Occupation[];
  categories: CategoryId[];
  /** 「センシティブな人物を隠す」設定で隠す理由（なければ null） */
  sensitive: string | null;
  jaTitle: string | null;
  jaUrl: string | null;
  wikidataUrl: string;
  image: PersonImage | null;
  score: Score;
}

export interface Hand {
  mode: DataMode;
  month: number;
  day: number;
  period: ScorePeriod;
  /** データを取得した日時（ISO 8601, UTC） */
  fetchedAt: string;
  people: Person[];
  /** 件数の上限で打ち切ったとき true（一覧が全件ではない） */
  truncated: boolean;
  /** 打ち切る前に見つかった人数 */
  totalFound: number;
  /** 手札を作るのにかかった時間（ミリ秒、段階ごと）。遅いときにどこが遅いかを見るため */
  timings?: Record<string, number>;
}

/** 「このカードで勝負」を押した時点で固定するカードの中身。 */
export interface SelectedCard {
  person: Person;
  category: CategoryId;
  mode: DataMode;
  period: ScorePeriod;
  fetchedAt: string;
  views: number;
  selectedAt: string;
}
