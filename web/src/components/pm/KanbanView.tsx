import { useState } from "react";
import type { Spec } from "../../types";
import { groupByFeature, groupKeyOf, PM_STATUSES, statusColorVar, statusLabel } from "../../lib/pm";
import { Icon, PriorityTag } from "../ui";
import type { PMViewChildProps } from "./PMView";

// カード = 1 要件 (要件名 / priority / feature / assignee / due)。
function Card({
  s,
  active,
  onSelect,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  s: Spec;
  active: boolean;
  onSelect: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const draggable = true; // PM 対象は requirement のみ (常に編集可)
  return (
    <div
      className={"pm-card" + (dragging ? " dragging" : "") + (active ? " active" : "")}
      draggable={draggable}
      onClick={() => onSelect(s.id)}
      onDragStart={
        draggable
          ? (e) => {
              onDragStart();
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      <div className="pm-card-title">{s.title || s.file}</div>
      <div className="pm-card-meta">
        {s.priority && <PriorityTag priority={s.priority} />}
        <span className="mono pm-dim">{groupKeyOf(s)}</span>
      </div>
      {(s.assignee || s.due) && (
        <div className="pm-card-foot">
          {s.assignee && (
            <span className="pm-chip">
              <Icon name="user" size={12} /> {s.assignee}
            </span>
          )}
          {s.due && (
            <span className="pm-chip mono">
              <Icon name="calendar" size={12} /> {s.due}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function KanbanView({ specs, groupByFeat, selectedId, onSelect, onSetMeta, onToast }: PMViewChildProps) {
  const [drag, setDrag] = useState<{ id: string | null; over: string | null }>({ id: null, over: null });

  // 列 = 4 標準 status + データ中の未知 status (空文字含む)。
  const cols: string[] = [...PM_STATUSES];
  for (const st of new Set(specs.map((s) => s.status || ""))) {
    if (!(PM_STATUSES as readonly string[]).includes(st)) cols.push(st);
  }

  const save = async (s: Spec, status: string) => {
    try {
      await onSetMeta(s.id, { status });
      onToast("status を更新しました", `${s.id} → ${statusLabel(status)}`);
    } catch {
      /* App 側で revert & エラートースト済み */
    }
  };

  const onDropCol = (col: string) => {
    const id = drag.id;
    setDrag({ id: null, over: null });
    if (!id) return;
    const s = specs.find((x) => x.id === id);
    if (!s || (s.status || "") === col) return;
    save(s, col);
  };

  if (specs.length === 0) {
    return <div className="pm-empty">要件がありません</div>;
  }

  return (
    <div className="pm-board">
      {cols.map((col) => {
        const items = specs.filter((s) => (s.status || "") === col);
        const groups = groupByFeat ? groupByFeature(items) : [{ key: "", label: "", items }];
        return (
          <div
            key={col || "_none"}
            className={"pm-col" + (drag.over === col ? " dragover" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              if (drag.over !== col) setDrag((d) => ({ ...d, over: col }));
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDropCol(col);
            }}
          >
            <div className="pm-col-head">
              <span className="pm-col-dot" style={{ background: statusColorVar(col) }} />
              {statusLabel(col)}
              <span className="pm-dim">{items.length}</span>
            </div>
            <div className="pm-col-body">
              {items.length === 0 && <div className="pm-col-empty">—</div>}
              {groups.map((g) => (
                <div key={g.key || "_all"}>
                  {groupByFeat && g.label && <div className="pm-subhead">{g.label}</div>}
                  {g.items.map((s) => (
                    <Card
                      key={s.id}
                      s={s}
                      active={s.id === selectedId}
                      onSelect={onSelect}
                      dragging={drag.id === s.id}
                      onDragStart={() => setDrag({ id: s.id, over: col })}
                      onDragEnd={() => setDrag({ id: null, over: null })}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
