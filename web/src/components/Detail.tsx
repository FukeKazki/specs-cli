import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Spec, SpecDetail } from "../types";
import { parseFront, dottedToPath } from "../lib/frontmatter";
import { isActionsHeading } from "../lib/actions";
import { Icon } from "./ui";
import { Markdown } from "./Markdown";
import { InfoPanel } from "./InfoPanel";

export interface DetailProps {
  id: string;
  specs: Spec[];
  theme: string;
  infoOpen: boolean;
  setInfoOpen: (fn: (v: boolean) => boolean) => void;
  onNavigate: (id: string) => void;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (message: string) => void;
  onToast: (message: string, sub?: string) => void;
}

export function Detail({
  id,
  specs,
  theme,
  infoOpen,
  setInfoOpen,
  onNavigate,
  onSaved,
  onDeleted,
  onError,
  onToast,
}: DetailProps) {
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editErr, setEditErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    setEditing(false);
    setEditErr(null);
    setLoading(true);
    api
      .get(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      })
      // 短いスケルトンでローディング状態を見せる。
      .finally(() => {
        window.setTimeout(() => {
          if (!cancelled) setLoading(false);
        }, 140);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const crumbs = id.split("/");

  // 本文中の相対リンクを SPA 遷移として解決する。
  const onDocClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (/^https?:/.test(href) || href.startsWith("#")) return;
    e.preventDefault();
    const dir = id.split("/").slice(0, -1).join("/");
    let target = href;
    if (!href.startsWith("/")) {
      const stack: string[] = [];
      (dir + "/" + href).split("/").forEach((p) => {
        if (p === "..") stack.pop();
        else if (p !== "." && p !== "") stack.push(p);
      });
      target = stack.join("/");
    }
    if (specs.find((s) => s.id === target)) onNavigate(target);
    else onToast("リンク先が見つかりません", target);
  };

  // frontmatter `related` の dotted id を実 id へ解決して遷移する。
  const onRelated = (ref: string) => {
    const path = dottedToPath(ref);
    let hit = path ? specs.find((s) => s.id === path) : undefined;
    if (!hit) {
      if (ref.startsWith("domain.glossary")) hit = specs.find((s) => s.type === "term");
      else if (ref.startsWith("domain.models")) hit = specs.find((s) => s.type === "model");
      else if (ref.startsWith("feature.")) {
        const fn = ref.split(".")[1];
        hit = specs.find((s) => s.feature === fn && s.type === "feature");
      }
    }
    if (hit) onNavigate(hit.id);
    else onToast("関連先が見つかりません", ref);
  };

  const startEdit = () => {
    if (!detail) return;
    setDraft(detail.content);
    setEditErr(null);
    setEditing(true);
  };

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      await api.update(id, draft);
      setDetail({ spec: detail.spec, content: draft });
      setEditing(false);
      setEditErr(null);
      onSaved();
      onToast("保存しました", id);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Actions のチェックボックス切り替えを本文に反映して保存する (Screen 実装状況)。
  // ラベル先頭の A-00n があれば ID で、無ければテキストで対象行を特定する。
  const toggleTask = async (label: string, checked: boolean) => {
    if (!detail) return;
    const idMatch = label.match(/\bA-\d+\b/);
    const lines = detail.content.split("\n");
    const idx = lines.findIndex((l) => {
      if (!/^\s*-\s*\[[ xX]\]/.test(l)) return false;
      const rest = l.replace(/^\s*-\s*\[[ xX]\]\s*/, "").trim();
      return idMatch ? rest.includes(idMatch[0]) : rest === label.trim();
    });
    if (idx < 0) return;
    lines[idx] = lines[idx].replace(/\[[ xX]\]/, checked ? "[x]" : "[ ]");
    const next = lines.join("\n");
    try {
      await api.update(id, next);
      setDetail({ ...detail, content: next });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    }
  };

  // 操作に新しい項目を A-00n 採番で追加し、編集モードへ遷移する (S-002 A-004)。
  const addAction = () => {
    if (!detail) return;
    const lines = detail.content.split("\n");
    const ai = lines.findIndex((l) => {
      const m = l.match(/^#{1,6}\s+(.*)$/);
      return m ? isActionsHeading(m[1]) : false;
    });
    const nums = [...detail.content.matchAll(/\bA-(\d+)\b/g)].map((m) => parseInt(m[1], 10));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    const newLine = `- [ ] A-${String(next).padStart(3, "0")} `;

    let insertAt: number;
    if (ai < 0) {
      // 操作セクションが無ければ末尾に新設する。
      if (lines[lines.length - 1]?.trim() !== "") lines.push("");
      lines.push("## 操作", "", newLine);
      insertAt = lines.length - 1;
    } else {
      // セクション終端 (次の見出し or EOF) の手前 (末尾の空行を除く) に挿入する。
      let end = lines.length;
      for (let i = ai + 1; i < lines.length; i++) {
        if (/^#{1,6}\s/.test(lines[i])) {
          end = i;
          break;
        }
      }
      let pos = end;
      while (pos > ai + 1 && lines[pos - 1].trim() === "") pos--;
      lines.splice(pos, 0, newLine);
      insertAt = pos;
    }

    const draftText = lines.join("\n");
    setDraft(draftText);
    setEditErr(null);
    setEditing(true);
    // 追加行の末尾へカーソルを移動する。
    const caret = lines.slice(0, insertAt + 1).join("\n").length;
    window.setTimeout(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(caret, caret);
    }, 0);
  };

  // 右情報レールから status を変更し frontmatter に保存する (S-002)。
  const changeStatus = async (status: string) => {
    if (!detail) return;
    try {
      await api.setMeta(id, { status });
      const fresh = await api.get(id);
      setDetail(fresh);
      onSaved();
      onToast("ステータスを更新しました", `${id} → ${status || "未設定"}`);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const remove = async () => {
    if (!detail) return;
    if (!confirm(`${detail.spec.file} を削除しますか？この操作は元に戻せません。`)) return;
    try {
      await api.remove(id);
      onDeleted();
      onToast("削除しました", detail.spec.file);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  // AI 参照 (@specs/<path> [L<line>]) をクリップボードへコピーする (R-011)。
  const copyRef = async (ref: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      onToast("コピーしました", ref);
    } catch {
      onError("クリップボードにコピーできませんでした");
    }
  };

  const spec = detail?.spec;
  const { front, body } = detail ? parseFront(detail.content) : { front: {}, body: "" };

  return (
    <main className="main">
      <div className="detail-toolbar">
        <div className="crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i > 0 && <span className="sep">/</span>}
              <span className={"seg mono" + (i === crumbs.length - 1 ? " cur" : "")}>{c}</span>
            </span>
          ))}
        </div>
        <span className="grow" />
        {editing ? (
          <>
            <span className="edit-banner">
              <span className="dot" /> 編集中
            </span>
            <button className="btn ghost" onClick={() => setEditing(false)}>
              キャンセル
            </button>
            <button className="btn primary" onClick={save} disabled={saving}>
              <Icon name="check" size={15} stroke={2} /> {saving ? "保存中…" : "保存"}
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={startEdit} disabled={!detail}>
              <Icon name="pencil" size={14} /> 編集
            </button>
            <button className="icon-btn" title="AI 参照 (@specs/…) をコピー" onClick={() => copyRef(`@specs/${id}`)}>
              <Icon name="link" size={16} />
            </button>
            {spec && spec.type !== "product" && (
              <button className="btn danger" onClick={remove} title="削除">
                <Icon name="trash" size={14} />
              </button>
            )}
            <button
              className={"icon-btn" + (infoOpen ? " on" : "")}
              title="情報パネル"
              onClick={() => setInfoOpen((v) => !v)}
            >
              <Icon name="info" size={17} />
            </button>
          </>
        )}
      </div>

      <div className="detail-wrap">
        <div className="detail-scroll scroll">
          {loadError ? (
            <div className="empty">
              <div className="empty-card">
                <div className="ico">
                  <Icon name="warn" size={26} />
                </div>
                <h3>読み込めませんでした</h3>
                <p>{loadError}</p>
              </div>
            </div>
          ) : editing ? (
            <div className="editor">
              <div className="editor-area">
                <textarea
                  ref={taRef}
                  value={draft}
                  spellCheck={false}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                      e.preventDefault();
                      save();
                    }
                  }}
                />
                {editErr && (
                  <div className="editor-err">
                    <Icon name="warn" size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                    {editErr}
                  </div>
                )}
              </div>
            </div>
          ) : loading || !detail ? (
            <div className="doc">
              <div className="skel" style={{ height: 34, width: "45%", marginBottom: 22 }} />
              <div className="skel" style={{ height: 18, width: "90%", marginBottom: 10 }} />
              <div className="skel" style={{ height: 18, width: "80%", marginBottom: 10 }} />
              <div className="skel" style={{ height: 18, width: "86%", marginBottom: 22 }} />
              <div className="skel" style={{ height: 120 }} />
            </div>
          ) : (
            <div className="doc" onClick={onDocClick}>
              <Markdown
                content={detail.content}
                theme={theme}
                path={`specs/${id}`}
                onCopyRef={copyRef}
                onToggleTask={toggleTask}
              />
            </div>
          )}
        </div>

        {!editing && spec && (
          <InfoPanel
            selected={spec}
            front={front}
            body={body}
            open={infoOpen}
            onRelated={onRelated}
            onStatusChange={changeStatus}
            onAddAction={addAction}
          />
        )}
      </div>
    </main>
  );
}
