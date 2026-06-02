// プロジェクト管理 (project-management feature) 用の共通ロジック。
// status の標準値・ラベル・色、フィルタ / グルーピング、日付ヘルパをまとめる。
import type { Spec } from "../types";

// R-002 の標準ステータス。かんばんの列・リスト・ガントで共通利用する。
export const PM_STATUSES = ["draft", "in-progress", "review", "done"] as const;

// PM ビュー独自のラベル (既存ドキュメント詳細の STATUS_LABEL とは別)。
export const PM_STATUS_LABEL: Record<string, string> = {
  draft: "未着手",
  "in-progress": "進行中",
  review: "レビュー",
  done: "完了",
};

// 未知の値はそのまま表示する (R-002: 消失させない)。
export function statusLabel(s: string): string {
  return PM_STATUS_LABEL[s] ?? (s || "未設定");
}

// ステータス色 (index.css の CSS 変数)。未知値は中間色。
export function statusColorVar(s: string): string {
  switch (s) {
    case "draft":
      return "var(--pm-draft)";
    case "in-progress":
      return "var(--pm-inprogress)";
    case "review":
      return "var(--pm-review)";
    case "done":
      return "var(--pm-done)";
    default:
      return "var(--faint)";
  }
}

// PM の対象は要件 (requirement) のみ。1 要件 = 1 項目で feature 単位にグルーピングする。
// 機能仕様 / API / 画面 / product / 用語 / モデルは進捗管理の対象外。
export function isPMItem(s: Spec): boolean {
  return s.type === "requirement";
}

// 要件番号 ("R-001" など) をファイル名から取り出す。なければ空。
export function reqNumber(s: Spec): string {
  const m = s.file.match(/^(R-\d+)/);
  return m ? m[1] : "";
}

export interface PMFilters {
  feature: string; // "" = すべて
  type: string;
  status: string;
  assignee: string;
}

export const emptyFilters: PMFilters = { feature: "", type: "", status: "", assignee: "" };

export function applyFilters(specs: Spec[], f: PMFilters): Spec[] {
  return specs.filter(
    (s) =>
      (!f.feature || groupKeyOf(s) === f.feature) &&
      (!f.type || s.type === f.type) &&
      (!f.status || (s.status || "") === f.status) &&
      (!f.assignee || (s.assignee || "") === f.assignee),
  );
}

// グルーピング / feature フィルタのキー。feature 無し (domain / product) は種別でまとめる。
export function groupKeyOf(s: Spec): string {
  if (s.feature) return s.feature;
  if (s.type === "term" || s.type === "model") return "domain";
  if (s.type === "product") return "product";
  return "その他";
}

export function groupLabel(key: string): string {
  if (key === "domain") return "ドメイン";
  if (key === "product") return "プロダクト";
  return key;
}

// specs を groupKey ごとにまとめ、ラベル昇順で返す。
export function groupByFeature(specs: Spec[]): { key: string; label: string; items: Spec[] }[] {
  const map = new Map<string, Spec[]>();
  for (const s of specs) {
    const k = groupKeyOf(s);
    (map.get(k) ?? map.set(k, []).get(k)!).push(s);
  }
  return Array.from(map.entries())
    .map(([key, items]) => ({ key, label: groupLabel(key), items }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// フィルタ候補 (重複排除・ソート済み)。
export function distinctGroups(specs: Spec[]): string[] {
  return Array.from(new Set(specs.map(groupKeyOf))).sort((a, b) => a.localeCompare(b));
}
export function distinctTypes(specs: Spec[]): string[] {
  return Array.from(new Set(specs.map((s) => s.type))).sort((a, b) => a.localeCompare(b));
}
export function distinctStatuses(specs: Spec[]): string[] {
  const known = PM_STATUSES as readonly string[];
  const extra = Array.from(new Set(specs.map((s) => s.status).filter((s) => s && !known.includes(s))));
  return [...PM_STATUSES, ...extra.sort()];
}
export function distinctAssignees(specs: Spec[]): string[] {
  return Array.from(new Set(specs.map((s) => s.assignee).filter((a): a is string => !!a))).sort((a, b) =>
    a.localeCompare(b),
  );
}

// ---- 日付ヘルパ (ガント用) ----

// YYYY-MM-DD をローカル日付として解釈する。不正なら null。
export function parseDate(s?: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return Number.isNaN(d.getTime()) ? null : d;
}

const DAY_MS = 86400000;

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// start / due が両方そろい妥当な仕様のみスケジュール済みとみなす。
export function isScheduled(s: Spec): boolean {
  const a = parseDate(s.start);
  const b = parseDate(s.due);
  return !!a && !!b && a.getTime() <= b.getTime();
}
