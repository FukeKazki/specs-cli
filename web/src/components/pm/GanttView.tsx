import { useMemo, useState } from "react";
import type { Spec } from "../../types";
import {
  addDays,
  daysBetween,
  groupByFeature,
  isScheduled,
  parseDate,
  statusColorVar,
  statusLabel,
} from "../../lib/pm";
import { Icon, PriorityTag } from "../ui";
import type { PMViewChildProps } from "./PMView";

type Gran = "day" | "week" | "month";
const PX_PER_DAY: Record<Gran, number> = { day: 26, week: 10, month: 4 };
const LABEL_W = 220;
const ROW_H = 30;
const AXIS_H = 34;

const pad = (n: number) => String(n).padStart(2, "0");

interface Tick {
  x: number;
  label: string;
  major: boolean;
}

function buildTicks(start: Date, end: Date, gran: Gran, ppd: number): Tick[] {
  const ticks: Tick[] = [];
  if (gran === "month") {
    let d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      ticks.push({ x: daysBetween(start, d) * ppd, label: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, major: true });
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  } else if (gran === "week") {
    let d = new Date(start);
    while (d <= end) {
      ticks.push({ x: daysBetween(start, d) * ppd, label: `${d.getMonth() + 1}/${d.getDate()}`, major: d.getDate() <= 7 });
      d = addDays(d, 7);
    }
  } else {
    let d = new Date(start);
    while (d <= end) {
      ticks.push({ x: daysBetween(start, d) * ppd, label: String(d.getDate()), major: d.getDate() === 1 });
      d = addDays(d, 1);
    }
  }
  return ticks;
}

export function GanttView({ specs, groupByFeat, selectedId, onSelect }: PMViewChildProps) {
  const [gran, setGran] = useState<Gran>("week");
  const ppd = PX_PER_DAY[gran];

  const scheduled = useMemo(
    () =>
      specs
        .filter(isScheduled)
        .sort((a, b) => (a.start || "").localeCompare(b.start || "") || (a.title || "").localeCompare(b.title || "")),
    [specs],
  );
  const unscheduled = useMemo(() => specs.filter((s) => !isScheduled(s)), [specs]);

  // 期間 (前後に余白)。
  const range = useMemo(() => {
    const starts = scheduled.map((s) => parseDate(s.start)!).filter(Boolean);
    const dues = scheduled.map((s) => parseDate(s.due)!).filter(Boolean);
    if (!starts.length) return null;
    const min = new Date(Math.min(...starts.map((d) => d.getTime())));
    const max = new Date(Math.max(...dues.map((d) => d.getTime())));
    return { start: addDays(min, -2), end: addDays(max, 3) };
  }, [scheduled]);

  // 描画行 (グループ見出し行を含む) と spec→行 index の対応。
  const { rows, rowIndex } = useMemo(() => {
    const rows: { label?: string; spec?: Spec }[] = [];
    if (groupByFeat) {
      for (const g of groupByFeature(scheduled)) {
        rows.push({ label: g.label });
        for (const s of g.items) rows.push({ spec: s });
      }
    } else {
      for (const s of scheduled) rows.push({ spec: s });
    }
    const rowIndex = new Map<string, number>();
    rows.forEach((r, i) => r.spec && rowIndex.set(r.spec.id, i));
    return { rows, rowIndex };
  }, [scheduled, groupByFeat]);

  const chartW = range ? daysBetween(range.start, range.end) * ppd : 0;
  const ticks = range ? buildTicks(range.start, range.end, gran, ppd) : [];

  const barGeom = (s: Spec) => {
    const a = parseDate(s.start)!;
    const b = parseDate(s.due)!;
    const left = daysBetween(range!.start, a) * ppd;
    const width = Math.max((daysBetween(a, b) + 1) * ppd, ppd);
    return { left, width };
  };

  // 依存線: depends_on が同じ表示集合内のスケジュール済み仕様を指すときのみ描画。
  const deps: { x1: number; y1: number; x2: number; y2: number }[] = [];
  if (range) {
    for (const s of scheduled) {
      if (!s.dependsOn) continue;
      const toIdx = rowIndex.get(s.id);
      if (toIdx === undefined) continue;
      const { left: toLeft } = barGeom(s);
      for (const depId of s.dependsOn) {
        if (depId === s.id) continue;
        const fromIdx = rowIndex.get(depId);
        if (fromIdx === undefined) continue;
        const dep = scheduled.find((x) => x.id === depId);
        if (!dep) continue;
        const g = barGeom(dep);
        deps.push({
          x1: g.left + g.width,
          y1: fromIdx * ROW_H + ROW_H / 2,
          x2: toLeft,
          y2: toIdx * ROW_H + ROW_H / 2,
        });
      }
    }
  }

  const granBtn = (g: Gran, label: string) => (
    <button className={"pm-gran" + (gran === g ? " on" : "")} onClick={() => setGran(g)}>
      {label}
    </button>
  );

  if (specs.length === 0) {
    return <div className="pm-empty">要件がありません</div>;
  }

  return (
    <div className="pm-gantt">
      <div className="pm-gantt-toolbar">
        <span className="pm-dim">時間軸</span>
        {granBtn("day", "日")}
        {granBtn("week", "週")}
        {granBtn("month", "月")}
      </div>

      {range ? (
        <div className="pm-gantt-scroll scroll">
          <div className="pm-gantt-inner" style={{ width: LABEL_W + chartW }}>
            {/* 時間軸ヘッダ */}
            <div className="pm-gantt-axis" style={{ height: AXIS_H }}>
              <div className="pm-gantt-axis-label" style={{ width: LABEL_W }} />
              <div className="pm-gantt-axis-track" style={{ width: chartW }}>
                {ticks.map((t, i) => (
                  <div key={i} className={"pm-tick" + (t.major ? " major" : "")} style={{ left: t.x }}>
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 行 */}
            <div className="pm-gantt-rows" style={{ position: "relative" }}>
              {rows.map((r, i) =>
                r.label !== undefined ? (
                  <div className="pm-gantt-row group" key={"g" + i} style={{ height: ROW_H }}>
                    <div className="pm-gantt-rowlabel" style={{ width: LABEL_W }}>
                      <b>{r.label}</b>
                    </div>
                    <div className="pm-gantt-rowtrack" style={{ width: chartW }} />
                  </div>
                ) : (
                  <div className={"pm-gantt-row" + (r.spec!.id === selectedId ? " active" : "")} key={r.spec!.id} style={{ height: ROW_H }}>
                    <div className="pm-gantt-rowlabel" style={{ width: LABEL_W }} onClick={() => onSelect(r.spec!.id)} title={r.spec!.title}>
                      {r.spec!.priority && <PriorityTag priority={r.spec!.priority} />}
                      <span className="pm-gantt-name">{r.spec!.title || r.spec!.file}</span>
                    </div>
                    <div className="pm-gantt-rowtrack" style={{ width: chartW }}>
                      {(() => {
                        const g = barGeom(r.spec!);
                        return (
                          <div
                            className="pm-bar"
                            style={{ left: g.left, width: g.width, background: statusColorVar(r.spec!.status || "") }}
                            title={`${statusLabel(r.spec!.status || "")} · ${r.spec!.start} 〜 ${r.spec!.due}`}
                            onClick={() => onSelect(r.spec!.id)}
                          />
                        );
                      })()}
                    </div>
                  </div>
                ),
              )}

              {/* 依存線オーバーレイ */}
              {deps.length > 0 && (
                <svg
                  className="pm-gantt-deps"
                  style={{ left: LABEL_W, top: 0, width: chartW, height: rows.length * ROW_H }}
                  width={chartW}
                  height={rows.length * ROW_H}
                >
                  <defs>
                    <marker id="pm-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
                      <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent)" />
                    </marker>
                  </defs>
                  {deps.map((d, i) => (
                    <path
                      key={i}
                      d={`M ${d.x1},${d.y1} C ${d.x1 + 24},${d.y1} ${d.x2 - 24},${d.y2} ${d.x2},${d.y2}`}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={1.4}
                      markerEnd="url(#pm-arrow)"
                    />
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="pm-empty">スケジュール済み (start / due 設定済み) の要件がありません</div>
      )}

      {/* 未スケジュール枠 */}
      {unscheduled.length > 0 && (
        <div className="pm-unscheduled">
          <div className="pm-unscheduled-head">
            <Icon name="calendar" size={14} /> 未スケジュール <span className="pm-dim">({unscheduled.length})</span>
          </div>
          <div className="pm-unscheduled-list">
            {unscheduled.map((s) => (
              <div key={s.id} className="pm-unscheduled-item" onClick={() => onSelect(s.id)}>
                {s.priority && <PriorityTag priority={s.priority} />}
                <span className="pm-gantt-name">{s.title || s.file}</span>
                <span className="pm-col-dot" style={{ background: statusColorVar(s.status || "") }} />
                <span className="pm-dim">{statusLabel(s.status || "")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
