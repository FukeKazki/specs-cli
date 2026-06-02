import { useEffect, useState, type ReactNode } from "react";
import type { Spec } from "../types";
import { Badge, Icon } from "./ui";

const IND = 13; // px per nesting level

// 選択中アイテムを表示するために開く必要のあるディスクロージャのキー一覧 (dashbaord S-001 L26)。
function ancestorKeys(s: Spec): string[] {
  if (s.id.startsWith("product/")) return ["g:product"];
  if (s.type === "term") return ["g:domain", "sub:terms"];
  if (s.type === "model") return ["g:domain", "sub:models"];
  const keys = ["g:features", "feat:" + s.feature];
  if (s.type === "requirement") keys.push("reqs:" + s.feature);
  if (s.type === "screen") keys.push("screens:" + s.feature);
  return keys;
}

export interface SidebarProps {
  specs: Spec[];
  activeId: string;
  open: boolean;
  onSelect: (id: string) => void;
  onAddFeature: () => void;
  onAddScreen: (feature: string) => void;
  onAddRequirement: (feature: string) => void;
  onAddTerm: () => void;
  onAddModel: () => void;
  onReorderScreens: (feature: string, orderedIds: string[]) => void;
}

function isProduct(s: Spec): boolean {
  return s.id.startsWith("product/");
}
function isDomain(s: Spec): boolean {
  return s.id.startsWith("domain/");
}
// Product ドキュメントは vision を先頭に、以降はファイル名昇順。
function sortProduct(a: Spec, b: Spec): number {
  const rank = (s: Spec) => (s.file === "vision.md" ? 0 : 1);
  return rank(a) - rank(b) || a.file.localeCompare(b.file);
}
function screenNumber(s: Spec): string {
  const m = s.file.match(/^(S-\d+|R-\d+)/);
  return m ? m[1] : s.file.replace(/\.md$/, "");
}

function Disclosure({
  label,
  open,
  onToggle,
  depth = 0,
  onAdd,
  addTitle,
  group,
  feature,
  active,
  mono,
  icon,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  depth?: number;
  onAdd?: () => void;
  addTitle?: string;
  group?: boolean;
  feature?: boolean;
  active?: boolean;
  mono?: boolean;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <div className={"disc" + (group ? " disc-group" : "") + (feature ? " disc-feature" : "")}>
      <div
        className={"disc-head" + (open ? "" : " collapsed") + (active ? " active" : "")}
        style={{ paddingLeft: 8 + depth * IND }}
        onClick={onToggle}
      >
        <span className="caret">
          <Icon name="caret" size={13} />
        </span>
        {icon && <Icon name={icon} size={14} className="dico" />}
        <span
          className="disc-label"
          style={mono ? { fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 } : undefined}
        >
          {label}
        </span>
        {onAdd && (
          <button
            className="add"
            title={addTitle}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            <Icon name="plus" size={14} stroke={2} />
          </button>
        )}
      </div>
      {open && <div className="disc-body">{children}</div>}
    </div>
  );
}

export function Sidebar({
  specs,
  activeId,
  open,
  onSelect,
  onAddFeature,
  onAddScreen,
  onAddRequirement,
  onAddTerm,
  onAddModel,
  onReorderScreens,
}: SidebarProps) {
  // デフォルトは全て閉じる (dashbaord S-001 L25)。expanded[k] が true のものだけ開く。
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drag, setDrag] = useState<{ id: string | null; over: string | null }>({ id: null, over: null });

  const isOpen = (k: string) => !!expanded[k];
  const toggle = (k: string) => setExpanded((o) => ({ ...o, [k]: !o[k] }));

  // 選択中アイテムが属する feature (機能名ハイライト用, dashbaord R-001)。
  const activeSpec = specs.find((s) => s.id === activeId);
  const activeFeature = activeSpec?.feature || "";

  // 選択中アイテムの祖先を自動展開する (dashbaord S-001 L26)。
  useEffect(() => {
    if (!activeSpec) return;
    const keys = ancestorKeys(activeSpec);
    setExpanded((o) => {
      if (keys.every((k) => o[k])) return o;
      const next = { ...o };
      for (const k of keys) next[k] = true;
      return next;
    });
  }, [activeSpec]);

  // 展開後、選択中の行をスクロール表示する (スクロール追従, dashbaord S-001 L26)。
  useEffect(() => {
    if (!activeId) return;
    const t = setTimeout(() => {
      document.querySelector(".sidebar .row.active")?.scrollIntoView({ block: "nearest" });
    }, 60);
    return () => clearTimeout(t);
  }, [activeId, expanded]);

  const products = specs.filter(isProduct).sort(sortProduct);
  const terms = specs.filter((s) => s.type === "term");
  const models = specs.filter((s) => s.type === "model");
  const features = Array.from(
    new Set(specs.filter((s) => !isDomain(s) && !isProduct(s) && s.feature).map((s) => s.feature)),
  ).sort((a, b) => a.localeCompare(b));

  const onDrop = (feature: string, overId: string) => {
    const dragId = drag.id;
    setDrag({ id: null, over: null });
    if (!dragId || dragId === overId) return;
    const ids = specs
      .filter((s) => s.type === "screen" && s.feature === feature)
      .sort((a, b) => a.order - b.order)
      .map((s) => s.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderScreens(feature, ids);
  };

  const Row = ({
    s,
    label,
    fileHint,
    depth,
    draggable,
    feature,
  }: {
    s: Spec;
    label: string;
    fileHint?: string;
    depth: number;
    draggable?: boolean;
    feature?: string;
  }) => (
    <div
      className={
        "row" +
        (s.id === activeId ? " active" : "") +
        (drag.id === s.id ? " dragging" : "") +
        (drag.over === s.id ? " dragover" : "")
      }
      style={{ paddingLeft: 9 + depth * IND }}
      onClick={() => onSelect(s.id)}
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              setDrag({ id: s.id, over: null });
              e.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      onDragOver={
        draggable
          ? (e) => {
              e.preventDefault();
              if (drag.over !== s.id) setDrag((d) => ({ ...d, over: s.id }));
            }
          : undefined
      }
      onDrop={
        draggable && feature
          ? (e) => {
              e.preventDefault();
              onDrop(feature, s.id);
            }
          : undefined
      }
      onDragEnd={draggable ? () => setDrag({ id: null, over: null }) : undefined}
    >
      {draggable && (
        <span className="grip">
          <Icon name="grip" size={14} stroke={2} />
        </span>
      )}
      <span className="rlabel">
        {(s.type === "screen" || s.type === "requirement") && <span className="rnum mono">{screenNumber(s)}</span>}
        {label}
        {fileHint && <span className="rfile mono">{fileHint}</span>}
      </span>
      <Badge type={s.type} />
    </div>
  );

  return (
    <aside className={"sidebar scroll" + (open ? "" : " collapsed")}>
      <div className="sb-search">
        <div className="field">
          <Icon name="search" size={15} />
          <input placeholder="仕様書を検索…" onChange={() => {}} />
          <span className="mono" style={{ fontSize: 11 }}>
            /
          </span>
        </div>
      </div>
      <nav className="sb-tree">
        {/* プロダクト */}
        {products.length > 0 && (
          <Disclosure label="プロダクト" group depth={0} open={isOpen("g:product")} onToggle={() => toggle("g:product")}>
            {products.map((s) => (
              <Row key={s.id} s={s} label={s.title} depth={1} />
            ))}
          </Disclosure>
        )}

        {/* ドメイン */}
        <Disclosure label="ドメイン" group depth={0} open={isOpen("g:domain")} onToggle={() => toggle("g:domain")}>
          <Disclosure
            label="ユビキタス言語"
            depth={1}
            open={isOpen("sub:terms")}
            onToggle={() => toggle("sub:terms")}
            onAdd={onAddTerm}
            addTitle="用語を追加"
          >
            {terms.length ? (
              terms.map((s) => <Row key={s.id} s={s} label={s.title} depth={2} />)
            ) : (
              <div className="row empty-row" style={{ paddingLeft: 9 + 2 * IND }}>
                用語がありません
              </div>
            )}
          </Disclosure>
          <Disclosure
            label="モデル"
            depth={1}
            open={isOpen("sub:models")}
            onToggle={() => toggle("sub:models")}
            onAdd={onAddModel}
            addTitle="モデルを追加"
          >
            {models.length ? (
              models.map((s) => <Row key={s.id} s={s} label={s.title} depth={2} />)
            ) : (
              <div className="row empty-row" style={{ paddingLeft: 9 + 2 * IND }}>
                モデルがありません
              </div>
            )}
          </Disclosure>
        </Disclosure>

        {/* 機能 */}
        <Disclosure
          label="機能"
          group
          depth={0}
          open={isOpen("g:features")}
          onToggle={() => toggle("g:features")}
          onAdd={onAddFeature}
          addTitle="新規 feature"
        >
          {features.map((f) => {
            const spec = specs.find((s) => s.feature === f && s.type === "feature");
            const requirements = specs
              .filter((s) => s.feature === f && s.type === "requirement")
              .sort((a, b) => a.order - b.order);
            const screens = specs
              .filter((s) => s.feature === f && s.type === "screen")
              .sort((a, b) => a.order - b.order);
            const fk = "feat:" + f;
            return (
              <Disclosure
                key={f}
                label={f}
                mono
                icon="cube"
                feature
                active={f === activeFeature}
                depth={1}
                open={isOpen(fk)}
                onToggle={() => toggle(fk)}
              >
                {spec && <Row s={spec} label="機能仕様" fileHint="spec.md" depth={2} />}
                <Disclosure
                  label="要件"
                  depth={2}
                  open={isOpen("reqs:" + f)}
                  onToggle={() => toggle("reqs:" + f)}
                  onAdd={() => onAddRequirement(f)}
                  addTitle="要件を追加"
                >
                  {requirements.length ? (
                    requirements.map((s) => (
                      <Row key={s.id} s={s} label={s.title.replace(/^R-\d+\s*/, "")} depth={3} />
                    ))
                  ) : (
                    <div className="row empty-row" style={{ paddingLeft: 9 + 3 * IND }}>
                      要件がありません
                    </div>
                  )}
                </Disclosure>
                <Disclosure
                  label="画面"
                  depth={2}
                  open={isOpen("screens:" + f)}
                  onToggle={() => toggle("screens:" + f)}
                  onAdd={() => onAddScreen(f)}
                  addTitle="画面を追加"
                >
                  {screens.length ? (
                    screens.map((s) => (
                      <Row key={s.id} s={s} label={s.title.replace(/^Screen:\s*/, "")} depth={3} draggable feature={f} />
                    ))
                  ) : (
                    <div className="row empty-row" style={{ paddingLeft: 9 + 3 * IND }}>
                      画面がありません
                    </div>
                  )}
                </Disclosure>
              </Disclosure>
            );
          })}
        </Disclosure>
      </nav>
    </aside>
  );
}
