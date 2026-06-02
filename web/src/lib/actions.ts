// Screen の `## 操作` を GFM タスクリストとして解釈し、実装状況を集計する。
// 記法: `- [x] A-001 列によるソート` (A-00n は任意の安定ID)。
export interface ActionItem {
  id: string | null; // 例: "A-001"
  text: string;
  done: boolean;
}

const ACTION_LINE = /^\s*-\s*\[([ xX])\]\s*(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

// 「操作」セクションの見出しか判定する (旧 "Actions" 表記も後方互換で許容)。
export function isActionsHeading(title: string): boolean {
  const t = title.trim();
  return t === "操作" || /^Actions\b/i.test(t);
}

// body から `## 操作` セクションのタスク項目を抽出する。
export function parseActions(body: string): ActionItem[] {
  const out: ActionItem[] = [];
  let inActions = false;
  for (const ln of body.split("\n")) {
    const h = ln.match(HEADING);
    if (h) {
      inActions = isActionsHeading(h[2]);
      continue;
    }
    if (!inActions) continue;
    const m = ln.match(ACTION_LINE);
    if (!m) continue;
    const done = m[1].toLowerCase() === "x";
    const rest = m[2].trim();
    const idm = rest.match(/^(A-\d+)\s+/);
    out.push({ id: idm ? idm[1] : null, text: idm ? rest.slice(idm[0].length).trim() : rest, done });
  }
  return out;
}

export function actionProgress(body: string): { done: number; total: number } {
  const items = parseActions(body);
  return { done: items.filter((i) => i.done).length, total: items.length };
}
