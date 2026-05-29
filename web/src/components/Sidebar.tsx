import { useState } from "react";
import type { Spec } from "../types";

interface Group {
  feature: string;
  docs: Spec[];
  screens: Spec[];
}

function groupByFeature(specs: Spec[]): Group[] {
  const groups: Group[] = [];
  const byFeature = new Map<string, Group>();
  for (const s of specs) {
    let g = byFeature.get(s.feature);
    if (!g) {
      g = { feature: s.feature, docs: [], screens: [] };
      byFeature.set(s.feature, g);
      groups.push(g);
    }
    (s.type === "screen" ? g.screens : g.docs).push(s);
  }
  return groups;
}

export interface SidebarProps {
  specs: Spec[];
  activeId: string;
  onSelect: (id: string) => void;
  onAddScreen: (feature: string) => void;
  onReorderScreens: (feature: string, orderedIds: string[]) => void;
  onAddTerm: () => void;
  onAddModel: () => void;
}

function isDomain(s: Spec): boolean {
  return s.id.startsWith("domain/");
}

export function Sidebar({
  specs,
  activeId,
  onSelect,
  onAddScreen,
  onReorderScreens,
  onAddTerm,
  onAddModel,
}: SidebarProps) {
  const [dragId, setDragId] = useState<string | null>(null);

  const terms = specs.filter((s) => s.type === "term");
  const models = specs.filter((s) => s.type === "model");
  const groups = groupByFeature(specs.filter((s) => !isDomain(s)));

  const entry = (s: Spec, label: string) => (
    <li
      key={s.id}
      className={`spec-item${s.id === activeId ? " active" : ""}`}
      onClick={() => onSelect(s.id)}
    >
      <span className="grip placeholder" />
      <span className="label">{label}</span>
      <span className="badge">{s.type}</span>
    </li>
  );

  const handleDrop = (feature: string, targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const screenIds = specs.filter((s) => s.feature === feature && s.type === "screen").map((s) => s.id);
    const from = screenIds.indexOf(dragId);
    const to = screenIds.indexOf(targetId);
    if (from < 0 || to < 0) return;
    screenIds.splice(from, 1);
    screenIds.splice(to, 0, dragId);
    onReorderScreens(feature, screenIds);
  };

  return (
    <aside className="sidebar">
      <div className="feature-group">
        <p className="feature-name">Domain</p>

        <div className="screens-head">
          <span>Ubiquitous Language</span>
          <button className="add-screen" title="用語を追加" onClick={onAddTerm}>
            + 用語
          </button>
        </div>
        <ul className="spec-list">{terms.map((s) => entry(s, s.title))}</ul>

        <div className="screens-head">
          <span>Models</span>
          <button className="add-screen" title="モデルを追加" onClick={onAddModel}>
            + モデル
          </button>
        </div>
        <ul className="spec-list">{models.map((s) => entry(s, s.title))}</ul>
      </div>

      {groups.map((g) => (
        <div className="feature-group" key={g.feature}>
          <p className="feature-name">{g.feature}</p>

          <ul className="spec-list">
            {g.docs.map((s) => (
              <li
                key={s.id}
                className={`spec-item${s.id === activeId ? " active" : ""}`}
                onClick={() => onSelect(s.id)}
              >
                <span className="grip placeholder" />
                <span className="label">{s.file}</span>
                <span className="badge">{s.type || "?"}</span>
              </li>
            ))}
          </ul>

          <div className="screens-head">
            <span>Screens</span>
            <button className="add-screen" title="画面を追加" onClick={() => onAddScreen(g.feature)}>
              + 画面
            </button>
          </div>

          <ul className="spec-list screens">
            {g.screens.map((s) => (
              <li
                key={s.id}
                className={`spec-item screen${s.id === activeId ? " active" : ""}${dragId === s.id ? " dragging" : ""}`}
                draggable
                onClick={() => onSelect(s.id)}
                onDragStart={() => setDragId(s.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  if (dragId && g.screens.some((x) => x.id === dragId)) {
                    e.preventDefault();
                    e.currentTarget.classList.add("drop-target");
                  }
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove("drop-target")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("drop-target");
                  handleDrop(g.feature, s.id);
                }}
              >
                <span className="grip">⠿</span>
                <span className="label">{s.title.replace(/^Screen:\s*/, "")}</span>
                <span className="badge">{s.type}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
