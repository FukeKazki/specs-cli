import type { Spec } from "../../types";
import {
  distinctAssignees,
  distinctGroups,
  distinctStatuses,
  distinctTypes,
  emptyFilters,
  groupLabel,
  statusLabel,
  type PMFilters,
} from "../../lib/pm";
import { TYPE_LABEL, Icon } from "../ui";

export interface PMToolbarProps {
  all: Spec[]; // フィルタ候補の算出に使う未フィルタの全 specs
  filters: PMFilters;
  onFilters: (f: PMFilters) => void;
  groupByFeat: boolean;
  onGroupByFeat: (g: boolean) => void;
}

export function PMToolbar({ all, filters, onFilters, groupByFeat, onGroupByFeat }: PMToolbarProps) {
  const set = (patch: Partial<PMFilters>) => onFilters({ ...filters, ...patch });
  const active =
    filters.feature || filters.type || filters.status || filters.assignee || groupByFeat;

  return (
    <div className="pm-toolbar">
      <label className="pm-field">
        <span>feature</span>
        <select value={filters.feature} onChange={(e) => set({ feature: e.target.value })}>
          <option value="">すべて</option>
          {distinctGroups(all).map((g) => (
            <option key={g} value={g}>
              {groupLabel(g)}
            </option>
          ))}
        </select>
      </label>

      <label className="pm-field">
        <span>type</span>
        <select value={filters.type} onChange={(e) => set({ type: e.target.value })}>
          <option value="">すべて</option>
          {distinctTypes(all).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t] ?? t}
            </option>
          ))}
        </select>
      </label>

      <label className="pm-field">
        <span>status</span>
        <select value={filters.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="">すべて</option>
          {distinctStatuses(all).map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </label>

      <label className="pm-field">
        <span>担当</span>
        <select value={filters.assignee} onChange={(e) => set({ assignee: e.target.value })}>
          <option value="">すべて</option>
          {distinctAssignees(all).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <label className="pm-group-toggle">
        <input type="checkbox" checked={groupByFeat} onChange={(e) => onGroupByFeat(e.target.checked)} />
        feature でグループ化
      </label>

      {active && (
        <button
          className="btn ghost pm-reset"
          onClick={() => {
            onFilters(emptyFilters);
            onGroupByFeat(false);
          }}
        >
          <Icon name="x" size={13} /> クリア
        </button>
      )}
    </div>
  );
}
