import { useEffect, useMemo, useState } from "react";
import type { Spec, SpecMeta } from "../../types";
import { applyFilters, isPMItem, type PMFilters } from "../../lib/pm";
import { Icon } from "../ui";
import { PMToolbar } from "./PMToolbar";
import { ListView } from "./ListView";
import { KanbanView } from "./KanbanView";
import { GanttView } from "./GanttView";
import { PMDetailPanel } from "./PMDetailPanel";

export type PMViewKind = "list" | "kanban" | "gantt";

// 各ビューが共通で受け取る props (specs はフィルタ適用済み)。
export interface PMViewChildProps {
  specs: Spec[];
  groupByFeat: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSetMeta: (id: string, meta: SpecMeta) => Promise<void>;
  onToast: (msg: string, sub?: string) => void;
  onError: (msg: string, sub?: string) => void;
}

export interface PMViewProps {
  specs: Spec[];
  view: PMViewKind;
  onView: (v: PMViewKind) => void;
  filters: PMFilters;
  onFilters: (f: PMFilters) => void;
  groupByFeat: boolean;
  onGroupByFeat: (g: boolean) => void;
  onSelect: (id: string) => void; // ドキュメントモードへ遷移 (フル詳細・編集)
  onSetMeta: (id: string, meta: SpecMeta) => Promise<void>;
  onToast: (msg: string, sub?: string) => void;
  onError: (msg: string, sub?: string) => void;
  theme: string;
}

const TABS: { kind: PMViewKind; label: string; icon: string }[] = [
  { kind: "list", label: "リスト", icon: "list" },
  { kind: "kanban", label: "かんばん", icon: "board" },
  { kind: "gantt", label: "ガント", icon: "gantt" },
];

export function PMView(props: PMViewProps) {
  const { specs, view, onView, filters, onFilters, groupByFeat, onGroupByFeat, theme } = props;
  // PM 対象 (要件) のみに絞る。
  const scoped = useMemo(() => specs.filter(isPMItem), [specs]);
  const filtered = useMemo(() => applyFilters(scoped, filters), [scoped, filters]);

  // 選択中の要件 (右サイドパネル表示, R-011)。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? scoped.find((s) => s.id === selectedId) ?? null : null;
  // 一覧から消えた (削除など) ら選択解除する。
  useEffect(() => {
    if (selectedId && !scoped.some((s) => s.id === selectedId)) setSelectedId(null);
  }, [scoped, selectedId]);

  const childProps: PMViewChildProps = {
    specs: filtered,
    groupByFeat,
    selectedId,
    onSelect: setSelectedId, // ビュー内選択 → 右パネル表示
    onSetMeta: props.onSetMeta,
    onToast: props.onToast,
    onError: props.onError,
  };

  return (
    <main className="main pm">
      <div className="pm-tabs">
        {TABS.map((t) => (
          <button
            key={t.kind}
            className={"pm-tab" + (view === t.kind ? " on" : "")}
            onClick={() => onView(t.kind)}
          >
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
        <span className="grow" />
        <span className="pm-count mono">
          {filtered.length}/{scoped.length} 件
        </span>
      </div>

      <PMToolbar all={scoped} filters={filters} onFilters={onFilters} groupByFeat={groupByFeat} onGroupByFeat={onGroupByFeat} />

      <div className="pm-content">
        <div className="pm-body scroll">
          {view === "list" && <ListView {...childProps} />}
          {view === "kanban" && <KanbanView {...childProps} />}
          {view === "gantt" && <GanttView {...childProps} />}
        </div>
        {selected && (
          <PMDetailPanel
            key={selected.id}
            spec={selected}
            theme={theme}
            onClose={() => setSelectedId(null)}
            onOpenDoc={props.onSelect}
          />
        )}
      </div>
    </main>
  );
}
