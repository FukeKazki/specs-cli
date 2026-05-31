/* ============================================================
   specs — main app
   ============================================================ */
const { useState, useEffect, useRef, useCallback } = React;
const { Icon, Badge, MetaBlock, MarkdownView } = window.SpecsLib;
const OpenApiView = window.OpenApiView;
const {
  useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle, TweakRadio,
} = window;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "accentH": 256,
  "density": "regular",
  "uiScale": 1,
  "radius": 9
}/*EDITMODE-END*/;

const ACCENTS = [
  { h: 256, name: "Indigo" },
  { h: 245, name: "Blue" },
  { h: 196, name: "Teal" },
  { h: 158, name: "Green" },
  { h: 28,  name: "Clay" },
  { h: 320, name: "Plum" },
];
const DENSITY_PAD = { compact: 5, regular: 7, comfy: 10 };

/* ---------- templates for create ---------- */
function tmplFeatureSpec(name) {
  return `---
id: feature.${name}
type: feature
status: draft
---

# Feature: ${name}

## Overview



## Users



## Scope

### Included

-

### Excluded

-

## Requirements

### R-001



## Screens


`;
}
function tmplApi(name) {
  return `openapi: 3.1.0
info:
  title: ${name} API
  version: 0.1.0
  description: |
    ${name} の API 仕様。
servers:
  - url: /api
paths: {}
components:
  schemas: {}
`;
}
function tmplScreen(feature, num, order, name) {
  return `---
id: feature.${feature}.screen.${num}
type: screen
feature: ${feature}
order: ${order}
status: draft
---

# Screen: ${name}

## Purpose



## Fields

-

## Actions

-

## Errors

-
`;
}
function tmplTerm(name) {
  return `---
id: domain.glossary.${name}
type: term
status: draft
---

# ${name}

## Definition



## Notes

<!-- 補足 -->

## Related

<!-- 関連する用語・Feature -->
`;
}
function tmplModel(name) {
  return `---
id: domain.models.${name}
type: model
status: draft
---

# ${name}

## Description



## Diagram

\`\`\`mermaid
classDiagram
    class ${name} {
        +string id
    }
\`\`\`
`;
}

/* ---------- helpers ---------- */
function titleFromBody(body, type) {
  const m = body.match(/^#\s+(.+)$/m);
  let t = m ? m[1].trim() : "Untitled";
  if (type === "feature") return t;          // "Feature: X"
  if (type === "screen") return t.replace(/^Screen:\s*/, "");
  return t;
}
function crumbsFor(id) {
  return id.split("/");
}

/* ============================================================ */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [specs, setSpecs] = useState(() => window.SPECS.map((s) => ({ ...s })));
  const [overrides, setOverrides] = useState({}); // id -> raw content
  const [selectedId, setSelectedId] = useState(() => (location.hash.slice(2) || "product/vision.md"));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editErr, setEditErr] = useState(null);
  const [modal, setModal] = useState(null); // { kind, feature }
  const [collapsed, setCollapsed] = useState({});
  const [sbOpen, setSbOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(() => window.innerWidth > 1180);
  const [toasts, setToasts] = useState([]);
  const [drag, setDrag] = useState({ id: null, over: null });
  const [loadingId, setLoadingId] = useState(null);

  /* ---- apply tweaks to <html> ---- */
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = t.theme;
    r.style.setProperty("--accent-h", t.accentH);
    r.style.setProperty("--density-pad", (DENSITY_PAD[t.density] || 7) + "px");
    r.style.setProperty("--ui-scale", t.uiScale);
    r.style.setProperty("--radius", t.radius + "px");
  }, [t.theme, t.accentH, t.density, t.uiScale, t.radius]);

  /* ---- hash sync ---- */
  useEffect(() => {
    const onHash = () => { const id = location.hash.slice(2); if (id) setSelectedId(id); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { if (selectedId) location.hash = "/" + selectedId; }, [selectedId]);

  const selected = specs.find((s) => s.id === selectedId) || null;
  const getContent = useCallback((id) => (id in overrides ? overrides[id] : window.getRaw(id)), [overrides]);

  /* ---- toast ---- */
  const toast = useCallback((msg, kind = "ok", sub) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((ts) => [...ts, { id, msg, kind, sub }]);
    setTimeout(() => setToasts((ts) => ts.map((x) => (x.id === id ? { ...x, out: true } : x))), 2600);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 2900);
  }, []);

  /* ---- selection (with brief skeleton to show loading state) ---- */
  const select = useCallback((id) => {
    if (id === selectedId) return;
    setEditing(false); setEditErr(null);
    setLoadingId(id);
    setSelectedId(id);
    if (window.innerWidth <= 860) setSbOpen(false);
    setTimeout(() => setLoadingId((cur) => (cur === id ? null : cur)), 140);
  }, [selectedId]);

  /* ---- link navigation inside docs ---- */
  const onDocClick = useCallback((e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (/^https?:/.test(href)) return; // external
    e.preventDefault();
    // resolve relative to current spec's directory
    const dir = selectedId.split("/").slice(0, -1).join("/");
    let target = href;
    if (!href.startsWith("/")) {
      const parts = (dir + "/" + href).split("/");
      const stack = [];
      parts.forEach((p) => { if (p === "..") stack.pop(); else if (p !== "." && p !== "") stack.push(p); });
      target = stack.join("/");
    }
    if (specs.find((s) => s.id === target)) select(target);
    else toast("リンク先が見つかりません", "err", target);
  }, [selectedId, specs, select, toast]);

  /* ---- edit ---- */
  const startEdit = () => { setDraft(getContent(selectedId)); setEditErr(null); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setEditErr(null); };
  const save = () => {
    if (selected.type === "api") {
      try {
        const doc = window.jsyaml.load(draft);
        if (!doc || !doc.openapi) throw new Error("`openapi` フィールドが必要です (OpenAPI 3.x)。");
        if (!doc.info || !doc.info.title) throw new Error("`info.title` が必要です。");
        if (typeof doc.paths !== "object") throw new Error("`paths` オブジェクトが必要です。");
      } catch (err) {
        setEditErr("OpenAPI 検証エラー\n" + (err.message || err));
        toast("検証エラー: 保存しませんでした", "err");
        return;
      }
    }
    setOverrides((o) => ({ ...o, [selectedId]: draft }));
    // refresh derived meta
    const parsed = window.parseFront(draft);
    setSpecs((ss) => ss.map((s) => {
      if (s.id !== selectedId) return s;
      const title = s.type === "api" ? s.title : titleFromBody(parsed.body, s.type);
      return { ...s, title, status: parsed.front.status || s.status };
    }));
    setEditing(false); setEditErr(null);
    toast("保存しました", "ok", selectedId);
  };

  /* ---- delete ---- */
  const del = () => {
    if (!selected || selected.type === "product") return;
    if (!window.confirm(`${selected.file} を削除しますか？この操作は元に戻せません。`)) return;
    const idx = specs.findIndex((s) => s.id === selectedId);
    const next = specs[idx + 1] || specs[idx - 1];
    setSpecs((ss) => ss.filter((s) => s.id !== selectedId));
    toast("削除しました", "ok", selected.file);
    if (next) select(next.id); else setSelectedId("");
  };

  /* ---- create ---- */
  const doCreate = (kind, feature, name) => {
    name = name.trim();
    if (!name) return;
    let newSpec, raw, id;
    if (kind === "feature") {
      id = `features/${name}/spec.md`;
      raw = tmplFeatureSpec(name);
      newSpec = { id, type: "feature", feature: name, file: "spec.md", title: `Feature: ${name}`, status: "draft" };
      const apiId = `features/${name}/api.yaml`;
      const apiRaw = tmplApi(name);
      setOverrides((o) => ({ ...o, [id]: raw, [apiId]: apiRaw }));
      setSpecs((ss) => [...ss, newSpec, { id: apiId, type: "api", feature: name, file: "api.yaml", title: `${name} API`, status: "draft" }]);
      window.FEATURE_ORDER = Array.from(new Set([...window.FEATURE_ORDER, name]));
      toast("feature を作成しました", "ok", name);
    } else if (kind === "screen") {
      const screens = specs.filter((s) => s.type === "screen" && s.feature === feature);
      const n = screens.length + 1;
      const num = "S-" + String(n).padStart(3, "0");
      id = `features/${feature}/screens/${num}.md`;
      raw = tmplScreen(feature, num, n, name);
      newSpec = { id, type: "screen", feature, file: num + ".md", title: name, status: "draft", number: num, order: n };
      setOverrides((o) => ({ ...o, [id]: raw }));
      setSpecs((ss) => [...ss, newSpec]);
      toast("画面を作成しました", "ok", `${num} · ${name}`);
    } else if (kind === "term") {
      id = `domain/glossary/${name}.md`;
      raw = tmplTerm(name);
      newSpec = { id, type: "term", file: `${name}.md`, title: name, status: "draft" };
      setOverrides((o) => ({ ...o, [id]: raw }));
      setSpecs((ss) => [...ss, newSpec]);
      toast("用語を作成しました", "ok", name);
    } else if (kind === "model") {
      id = `domain/models/${name}.md`;
      raw = tmplModel(name);
      newSpec = { id, type: "model", file: `${name}.md`, title: name, status: "draft" };
      setOverrides((o) => ({ ...o, [id]: raw }));
      setSpecs((ss) => [...ss, newSpec]);
      toast("モデルを作成しました", "ok", name);
    }
    setModal(null);
    setTimeout(() => select(id), 0);
  };

  /* ---- screen drag reorder ---- */
  const onDrop = (feature, overId) => {
    const dragId = drag.id;
    setDrag({ id: null, over: null });
    if (!dragId || dragId === overId) return;
    const screens = specs.filter((s) => s.type === "screen" && s.feature === feature).sort((a, b) => a.order - b.order);
    const ids = screens.map((s) => s.id);
    const from = ids.indexOf(dragId), to = ids.indexOf(overId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    setSpecs((ss) => ss.map((s) => {
      if (s.type === "screen" && s.feature === feature) {
        const ord = ids.indexOf(s.id) + 1;
        return { ...s, order: ord };
      }
      return s;
    }));
    toast("並び順を保存しました", "ok", feature);
  };

  const toggleGroup = (k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  /* ---- related-link resolution (frontmatter `related` dotted ids) ---- */
  const onRelated = useCallback((ref) => {
    // try exact frontmatter id match first
    let hit = specs.find((s) => {
      const { front } = window.parseFront(getContent(s.id));
      return front.id === ref;
    });
    if (!hit) {
      if (ref.startsWith("domain.glossary")) hit = specs.find((s) => s.type === "term");
      else if (ref.startsWith("domain.models")) hit = specs.find((s) => s.type === "model");
      else if (ref.startsWith("feature.")) {
        const fn = ref.split(".")[1];
        hit = specs.find((s) => s.feature === fn && s.type === "feature");
      }
    }
    if (hit) select(hit.id);
    else toast("関連先が見つかりません", "err", ref);
  }, [specs, getContent, select, toast]);

  return (
    <div className="app">
      <TopBar
        t={t} setTweak={setTweak}
        onNewFeature={() => setModal({ kind: "feature" })}
        sbOpen={sbOpen} setSbOpen={setSbOpen}
      />
      <div className="body">
        <div className={"scrim-sb" + (sbOpen && window.innerWidth <= 860 ? " show" : "")} onClick={() => setSbOpen(false)} />
        <Sidebar
          specs={specs} selectedId={selectedId} select={select}
          collapsed={collapsed} toggleGroup={toggleGroup}
          sbOpen={sbOpen}
          openModal={setModal}
          drag={drag} setDrag={setDrag} onDrop={onDrop}
        />
        <Main
          selected={selected} loading={loadingId === selectedId && !!loadingId}
          editing={editing} draft={draft} setDraft={setDraft} editErr={editErr}
          theme={t.theme} getContent={getContent}
          startEdit={startEdit} cancelEdit={cancelEdit} save={save} del={del}
          onDocClick={onDocClick} sbOpen={sbOpen} setSbOpen={setSbOpen}
          infoOpen={infoOpen} setInfoOpen={setInfoOpen} onRelated={onRelated}
        />
      </div>

      {modal && <CreateModal modal={modal} onClose={() => setModal(null)} onCreate={doCreate} />}

      <div className="toasts">
        {toasts.map((x) => (
          <div className={"toast " + x.kind + (x.out ? " out" : "")} key={x.id}>
            <span className="ti"><Icon name={x.kind === "err" ? "warn" : "ok"} size={16} /></span>
            <div className="tx"><div>{x.msg}</div>{x.sub && <div className="sub mono">{x.sub}</div>}</div>
          </div>
        ))}
      </div>

      <TweaksPanel>
        <TweakSection label="テーマ" />
        <TweakRadio label="モード" value={t.theme} options={["light", "dark"]} onChange={(v) => setTweak("theme", v)} />
        <TweakRow label="アクセント">
          <div style={{ display: "flex", gap: 7 }}>
            {ACCENTS.map((a) => (
              <button key={a.h} title={a.name} onClick={() => setTweak("accentH", a.h)}
                style={{
                  width: 22, height: 22, borderRadius: "50%", cursor: "pointer",
                  background: `oklch(0.58 0.16 ${a.h})`,
                  border: t.accentH === a.h ? "2px solid var(--text)" : "2px solid transparent",
                  outline: "1px solid var(--border)", padding: 0,
                }} />
            ))}
          </div>
        </TweakRow>
        <TweakSection label="レイアウト" />
        <TweakRadio label="密度" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="文字サイズ" value={t.uiScale} min={0.9} max={1.15} step={0.05} onChange={(v) => setTweak("uiScale", v)} />
        <TweakSlider label="角丸" value={t.radius} min={3} max={16} step={1} unit="px" onChange={(v) => setTweak("radius", v)} />
      </TweaksPanel>
    </div>
  );
}

/* ============================================================
   Top bar
   ============================================================ */
function TopBar({ t, setTweak, onNewFeature, sbOpen, setSbOpen }) {
  return (
    <div className="topbar">
      <button className="icon-btn" onClick={() => setSbOpen((v) => !v)} title="サイドバー">
        <Icon name={sbOpen ? "panel" : "panelOpen"} />
      </button>
      <div className="brand">
        <span className="glyph">§</span>
        <span className="name">spec<b>s</b></span>
      </div>
      <span className="path-hint mono">~/project/specs · 127.0.0.1:8787</span>
      <span className="grow" />
      <button className="icon-btn" title="テーマ切り替え"
        onClick={() => setTweak("theme", t.theme === "dark" ? "light" : "dark")}>
        <Icon name={t.theme === "dark" ? "sun" : "moon"} size={17} />
      </button>
      <button className="btn primary" onClick={onNewFeature}>
        <span className="kbd"><Icon name="plus" size={15} stroke={2} /></span> 新規 feature
      </button>
    </div>
  );
}

/* ============================================================
   Sidebar
   ============================================================ */
function Sidebar({ specs, selectedId, select, collapsed, toggleGroup, sbOpen, openModal, drag, setDrag, onDrop }) {
  const byType = (ty) => specs.filter((s) => s.type === ty);
  const products = ["product/vision.md", "product/principles.md"]
    .map((id) => specs.find((s) => s.id === id)).filter(Boolean)
    .concat(byType("product").filter((s) => !s.id.startsWith("product/vision") && !s.id.startsWith("product/principles")));
  const terms = byType("term");
  const models = byType("model");
  const features = window.FEATURE_ORDER.filter((f) => specs.some((s) => s.feature === f));
  const isOpen = (k) => !collapsed[k];
  const IND = 13; // px per nesting level

  const Row = ({ s, label, fileHint, depth, draggable, feature }) => (
    <div
      className={"row" +
        (s.id === selectedId ? " active" : "") +
        (drag.id === s.id ? " dragging" : "") +
        (drag.over === s.id ? " dragover" : "")}
      style={{ paddingLeft: 9 + depth * IND }}
      onClick={() => select(s.id)}
      draggable={draggable}
      onDragStart={draggable ? (e) => { setDrag({ id: s.id, over: null }); e.dataTransfer.effectAllowed = "move"; } : undefined}
      onDragOver={draggable ? (e) => { e.preventDefault(); if (drag.over !== s.id) setDrag((d) => ({ ...d, over: s.id })); } : undefined}
      onDrop={draggable ? (e) => { e.preventDefault(); onDrop(feature, s.id); } : undefined}
      onDragEnd={draggable ? () => setDrag({ id: null, over: null }) : undefined}
    >
      {draggable && <span className="grip"><Icon name="grip" size={14} stroke={2} /></span>}
      <span className="rlabel">
        {s.type === "screen" && <span className="rnum mono">{s.number}</span>}
        {label}
        {fileHint && <span className="rfile mono">{fileHint}</span>}
      </span>
      <Badge type={s.type} />
    </div>
  );

  return (
    <aside className={"sidebar scroll" + (sbOpen ? "" : " collapsed")}>
      <div className="sb-search">
        <div className="field">
          <Icon name="search" size={15} />
          <input placeholder="仕様書を検索…" onChange={() => {}} />
          <span className="mono" style={{ fontSize: 11 }}>/</span>
        </div>
      </div>
      <nav className="sb-tree">

        {/* プロダクト */}
        <Disclosure label="プロダクト" group depth={0}
          open={isOpen("g:product")} onToggle={() => toggleGroup("g:product")}>
          {products.map((s) => <Row key={s.id} s={s} label={s.title} depth={1} />)}
        </Disclosure>

        {/* ドメイン */}
        <Disclosure label="ドメイン" group depth={0}
          open={isOpen("g:domain")} onToggle={() => toggleGroup("g:domain")}>
          <Disclosure label="ユビキタス言語" depth={1}
            open={isOpen("sub:terms")} onToggle={() => toggleGroup("sub:terms")}
            onAdd={() => openModal({ kind: "term" })} addTitle="用語を追加">
            {terms.map((s) => <Row key={s.id} s={s} label={s.title} depth={2} />)}
          </Disclosure>
          <Disclosure label="モデル" depth={1}
            open={isOpen("sub:models")} onToggle={() => toggleGroup("sub:models")}
            onAdd={() => openModal({ kind: "model" })} addTitle="モデルを追加">
            {models.map((s) => <Row key={s.id} s={s} label={s.title} depth={2} />)}
          </Disclosure>
        </Disclosure>

        {/* 機能 */}
        <Disclosure label="機能" group depth={0}
          open={isOpen("g:features")} onToggle={() => toggleGroup("g:features")}
          onAdd={() => openModal({ kind: "feature" })} addTitle="新規 feature">
          {features.map((f) => {
            const spec = specs.find((s) => s.feature === f && s.type === "feature");
            const api = specs.find((s) => s.feature === f && s.type === "api");
            const screens = specs.filter((s) => s.feature === f && s.type === "screen").sort((a, b) => a.order - b.order);
            const fk = "feat:" + f;
            return (
              <Disclosure key={f} label={f} mono icon="cube" feature depth={1}
                open={isOpen(fk)} onToggle={() => toggleGroup(fk)}>
                {spec && <Row s={spec} label="機能仕様" fileHint="spec.md" depth={2} />}
                {api && <Row s={api} label="API 仕様" fileHint="api.yaml" depth={2} />}
                <Disclosure label="画面" depth={2}
                  open={isOpen("screens:" + f)} onToggle={() => toggleGroup("screens:" + f)}
                  onAdd={() => openModal({ kind: "screen", feature: f })} addTitle="画面を追加">
                  {screens.length
                    ? screens.map((s) => <Row key={s.id} s={s} label={s.title} depth={3} draggable feature={f} />)
                    : <div className="row" style={{ paddingLeft: 9 + 3 * IND, color: "var(--faint)", fontSize: 12, cursor: "default" }}>画面がありません</div>}
                </Disclosure>
              </Disclosure>
            );
          })}
        </Disclosure>
      </nav>
    </aside>
  );
}

function Disclosure({ label, open, onToggle, depth = 0, onAdd, addTitle, group, feature, mono, icon, children }) {
  return (
    <div className={"disc" + (group ? " disc-group" : "") + (feature ? " disc-feature" : "")}>
      <div className={"disc-head" + (open ? "" : " collapsed")}
        style={{ paddingLeft: 8 + depth * 13 }} onClick={onToggle}>
        <span className="caret"><Icon name="caret" size={13} /></span>
        {icon && <Icon name={icon} size={14} className="dico" />}
        <span className="disc-label" style={mono ? { fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 } : null}>{label}</span>
        {onAdd && (
          <button className="add" title={addTitle} onClick={(e) => { e.stopPropagation(); onAdd(); }}>
            <Icon name="plus" size={14} stroke={2} />
          </button>
        )}
      </div>
      {open && <div className="disc-body">{children}</div>}
    </div>
  );
}

/* ============================================================
   Main detail
   ============================================================ */
function Main({ selected, loading, editing, draft, setDraft, editErr, theme, getContent,
  startEdit, cancelEdit, save, del, onDocClick, sbOpen, setSbOpen, infoOpen, setInfoOpen, onRelated }) {

  if (!selected) {
    return (
      <main className="main">
        <div className="empty">
          <div className="empty-card">
            <div className="ico"><Icon name="doc" size={26} /></div>
            <h3>仕様書が選択されていません</h3>
            <p>左の一覧から仕様書を選ぶか、「新規 feature」で作成してください。</p>
          </div>
        </div>
      </main>
    );
  }

  const raw = getContent(selected.id);
  const { front, body } = window.parseFront(raw);
  const crumbs = crumbsFor(selected.id);

  return (
    <main className="main">
      <div className="detail-toolbar">
        <div className="crumbs">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="sep">/</span>}
              <span className={"seg mono" + (i === crumbs.length - 1 ? " cur" : "")}>{c}</span>
            </React.Fragment>
          ))}
        </div>
        <span className="grow" />
        {editing ? (
          <>
            <span className="edit-banner"><span className="dot" /> 編集中</span>
            <button className="btn ghost" onClick={cancelEdit}>キャンセル</button>
            <button className="btn primary" onClick={save}><Icon name="check" size={15} stroke={2} /> 保存</button>
          </>
        ) : (
          <>
            <button className="btn" onClick={startEdit}><Icon name="pencil" size={14} /> 編集</button>
            {selected.type !== "product" && (
              <button className="btn danger" onClick={del} title="削除"><Icon name="trash" size={14} /></button>
            )}
            <button className={"icon-btn" + (infoOpen ? " on" : "")} title="情報パネル"
              onClick={() => setInfoOpen((v) => !v)} style={infoOpen ? { background: "var(--panel-2)", color: "var(--text)", borderColor: "var(--border)" } : null}>
              <Icon name="info" size={17} />
            </button>
          </>
        )}
      </div>

      <div className="detail-wrap">
        <div className="detail-scroll scroll">
          {editing ? (
            <div className="editor">
              <div className="editor-area">
                <textarea
                  value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } }}
                />
                {editErr && <div className="editor-err"><Icon name="warn" size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />{editErr}</div>}
              </div>
            </div>
          ) : loading ? (
            <div className="doc">
              <div className="skel" style={{ height: 34, width: "45%", marginBottom: 22 }} />
              <div className="skel" style={{ height: 18, width: "90%", marginBottom: 10 }} />
              <div className="skel" style={{ height: 18, width: "80%", marginBottom: 10 }} />
              <div className="skel" style={{ height: 18, width: "86%", marginBottom: 22 }} />
              <div className="skel" style={{ height: 120 }} />
            </div>
          ) : (
            <div className="doc" onClick={onDocClick}>
              {selected.type === "api" ? (
                <OpenApiView raw={raw} />
              ) : (
                <MarkdownView body={body} theme={theme} />
              )}
            </div>
          )}
        </div>

        {!editing && (
          <InfoPanel selected={selected} front={front} body={body} open={infoOpen} onRelated={onRelated} onClose={() => setInfoOpen(false)} />
        )}
      </div>
    </main>
  );
}

/* ============================================================
   Right info rail — frontmatter / metadata, out of the reading flow
   ============================================================ */
function InfoPanel({ selected, front, body, open, onRelated, onClose }) {
  // build a table-of-contents from H2/H3 headings
  const toc = [];
  const re = /^(##|###)\s+(.+)$/gm;
  let m;
  while ((m = re.exec(body))) toc.push({ level: m[1].length, text: m[2].trim() });

  const STATUS_LABEL = { draft: "下書き", review: "レビュー中", done: "確定" };
  const TYPE_JA = window.SpecsLib.TYPE_LABEL;

  // related entries (frontmatter `related`) → resolve to ids when possible
  const related = Array.isArray(front.related) ? front.related : [];

  return (
    <aside className={"info-rail scroll" + (open ? "" : " hidden")}>
      <div className="info-pad">
        <div className="info-railhead"><Icon name="info" size={14} /> 情報</div>

        <div className="info-block">
          <div className="info-label">種別</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge type={selected.type} />
            {(front.status || selected.status) && (
              <span className="status-pill"><span className="dot" />{STATUS_LABEL[front.status || selected.status] || front.status || selected.status}</span>
            )}
          </div>
        </div>

        {selected.type === "screen" && selected.number && (
          <div className="info-block">
            <div className="info-label">画面番号</div>
            <div className="info-row"><span className="v">{selected.number} · 表示順 {selected.order}</span></div>
          </div>
        )}

        {(() => {
          // remaining frontmatter keys (skip type/status/related already shown)
          const skip = { type: 1, status: 1, related: 1 };
          const keys = Object.keys(front).filter((k) => !skip[k] && !Array.isArray(front[k]));
          if (!keys.length && selected.type === "api") {
            return null;
          }
          if (!keys.length) return null;
          return (
            <div className="info-block">
              <div className="info-label">frontmatter</div>
              <div className="info-kv">
                {keys.map((k) => (
                  <div className="info-row" key={k}>
                    <span className="k">{k}</span>
                    <span className="v">{String(front[k])}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {!!related.length && (
          <div className="info-block">
            <div className="info-label">関連</div>
            <div className="info-related">
              {related.map((r, i) => (
                <a key={i} href="#" onClick={(e) => { e.preventDefault(); onRelated(r); }}>
                  <Icon name="link" size={13} /> {r}
                </a>
              ))}
            </div>
          </div>
        )}

        {!!toc.length && (
          <div className="info-block">
            <div className="info-label">目次</div>
            <div className="info-toc">
              {toc.map((h, i) => (
                <a key={i} href="#" className={h.level === 3 ? "h3" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    const scroller = document.querySelector(".detail-scroll");
                    const heads = document.querySelectorAll(".doc .md h2, .doc .md h3");
                    heads.forEach((el) => {
                      if (el.textContent.trim() === h.text && scroller) {
                        scroller.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
                      }
                    });
                  }}>{h.text}</a>
              ))}
            </div>
          </div>
        )}

        <div className="info-block">
          <div className="info-label">パス</div>
          <div className="info-path">specs/{selected.id}</div>
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   Create modal
   ============================================================ */
function CreateModal({ modal, onClose, onCreate }) {
  const copy = window.CREATE_COPY[modal.kind];
  const [name, setName] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = modal.kind === "screen" ? `${copy.title} — ${modal.feature}` : copy.title;
  const submit = () => onCreate(modal.kind, modal.feature, name);

  // live preview of generated files
  const preview = (() => {
    const n = name.trim() || "…";
    if (modal.kind === "feature") return [`features/${n}/spec.md`, `features/${n}/api.yaml`];
    if (modal.kind === "screen") return [`features/${modal.feature}/screens/S-00n.md`];
    if (modal.kind === "term") return [`domain/glossary/${n}.md`];
    if (modal.kind === "model") return [`domain/models/${n}.md`];
    return [];
  })();

  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <p className="hint">{copy.hint}</p>
        </div>
        <div className="modal-body">
          <label className="input-label">名前</label>
          <input ref={inputRef} type="text" value={name} placeholder={copy.placeholder}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
          <div className="gen-preview">
            {preview.map((p, i) => (
              <div className="ln" key={i}><span className="plus">+</span> <span>{p}</span></div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>キャンセル</button>
          <button className="btn primary" disabled={!name.trim()} onClick={submit}
            style={{ opacity: name.trim() ? 1 : 0.5 }}>
            <Icon name="plus" size={15} stroke={2} /> 作成
          </button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
