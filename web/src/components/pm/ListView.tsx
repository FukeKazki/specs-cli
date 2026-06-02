import { useEffect, useMemo, useState } from "react";
import type { Spec } from "../../types";
import { groupByFeature, groupKeyOf, PM_STATUSES, statusLabel } from "../../lib/pm";
import { Icon, PriorityTag } from "../ui";
import type { PMViewChildProps } from "./PMView";

type Col = "title" | "priority" | "feature" | "status" | "assignee" | "start" | "due";

const PRIORITY_RANK: Record<string, number> = { Must: 0, Should: 1, Could: 2, "Won't": 3 };

const COLS: { key: Col; label: string }[] = [
  { key: "title", label: "要件" },
  { key: "priority", label: "priority" },
  { key: "feature", label: "feature" },
  { key: "status", label: "status" },
  { key: "assignee", label: "assignee" },
  { key: "start", label: "start" },
  { key: "due", label: "due" },
];

function sortValue(s: Spec, col: Col): string {
  switch (col) {
    case "title":
      return s.title || "";
    case "priority":
      return String(PRIORITY_RANK[s.priority || ""] ?? 9);
    case "feature":
      return groupKeyOf(s);
    case "status":
      return s.status || "";
    case "assignee":
      return s.assignee || "";
    case "start":
      return s.start || "";
    case "due":
      return s.due || "";
  }
}

// status のセレクト (4 標準値 + 既存の未知値)。
function StatusSelect({ spec, onChange }: { spec: Spec; onChange: (v: string) => void }) {
  const opts = [...PM_STATUSES] as string[];
  if (spec.status && !opts.includes(spec.status)) opts.push(spec.status);
  return (
    <select
      className="pm-cell-input"
      value={spec.status || ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">未設定</option>
      {opts.map((o) => (
        <option key={o} value={o}>
          {statusLabel(o)}
        </option>
      ))}
    </select>
  );
}

// 担当: ローカル下書きを持ち blur / Enter で確定する。
function AssigneeCell({ spec, onCommit }: { spec: Spec; onCommit: (v: string) => void }) {
  const [v, setV] = useState(spec.assignee || "");
  useEffect(() => setV(spec.assignee || ""), [spec.assignee]);
  const commit = () => {
    const next = v.trim();
    if (next !== (spec.assignee || "")) onCommit(next);
  };
  return (
    <input
      className="pm-cell-input"
      type="text"
      placeholder="—"
      value={v}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function DateCell({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <input
      className="pm-cell-input mono"
      type="date"
      value={value || ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function ListView({ specs, groupByFeat, selectedId, onSelect, onSetMeta, onToast }: PMViewChildProps) {
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: "feature", dir: 1 });

  const clickSort = (col: Col) =>
    setSort((s) => (s.col === col ? { col, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { col, dir: 1 }));

  const sorted = useMemo(() => {
    const arr = [...specs];
    arr.sort((a, b) => {
      const va = sortValue(a, sort.col);
      const vb = sortValue(b, sort.col);
      // 空値は常に末尾へ。
      if (va === "" && vb !== "") return 1;
      if (vb === "" && va !== "") return -1;
      return va.localeCompare(vb) * sort.dir;
    });
    return arr;
  }, [specs, sort]);

  const save = async (s: Spec, patch: Parameters<typeof onSetMeta>[1]) => {
    try {
      await onSetMeta(s.id, patch);
      onToast("保存しました", s.id);
    } catch {
      /* App 側でトースト & revert 済み */
    }
  };

  if (specs.length === 0) {
    return <div className="pm-empty">要件がありません</div>;
  }

  const renderRow = (s: Spec) => (
    <tr key={s.id} className={"pm-row" + (s.id === selectedId ? " active" : "")} onClick={() => onSelect(s.id)}>
      <td className="pm-title">{s.title || s.file}</td>
      <td>{s.priority ? <PriorityTag priority={s.priority} /> : <span className="pm-dim">—</span>}</td>
      <td className="mono pm-dim">{groupKeyOf(s)}</td>
      <td>
        <StatusSelect spec={s} onChange={(v) => save(s, { status: v })} />
      </td>
      <td>
        <AssigneeCell spec={s} onCommit={(v) => save(s, { assignee: v })} />
      </td>
      <td>
        <DateCell value={s.start} onChange={(v) => save(s, { start: v })} />
      </td>
      <td>
        <DateCell value={s.due} onChange={(v) => save(s, { due: v })} />
      </td>
    </tr>
  );

  const header = (
    <thead>
      <tr>
        {COLS.map((c) => (
          <th key={c.key} onClick={() => clickSort(c.key)} className={sort.col === c.key ? "sorted" : ""}>
            {c.label}
            {sort.col === c.key && <Icon name="caret" size={12} style={{ transform: sort.dir === -1 ? "rotate(180deg)" : undefined }} />}
          </th>
        ))}
      </tr>
    </thead>
  );

  if (groupByFeat) {
    const groups = groupByFeature(sorted);
    return (
      <div className="pm-list">
        {groups.map((g) => (
          <div className="pm-group" key={g.key}>
            <div className="pm-group-head">
              {g.label} <span className="pm-dim">({g.items.length})</span>
            </div>
            <table className="pm-table">
              {header}
              <tbody>{g.items.map(renderRow)}</tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pm-list">
      <table className="pm-table">
        {header}
        <tbody>{sorted.map(renderRow)}</tbody>
      </table>
    </div>
  );
}
