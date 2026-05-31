/* ============================================================
   specs — shared UI lib: icons, badges, markdown + mermaid
   ============================================================ */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------- Icons (stroke, 1.6) ---------- */
const ICON = {
  plus:    "M10 4.5v11M4.5 10h11",
  search:  "M8.5 14a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11ZM13 13l3.5 3.5",
  chevron: "M7.5 5l5 5-5 5",
  caret:   "M5 7.5l5 5 5-5",
  sun:     "M10 3.2v1.6M10 15.2v1.6M3.2 10h1.6M15.2 10h1.6M5.2 5.2l1.1 1.1M13.7 13.7l1.1 1.1M14.8 5.2l-1.1 1.1M6.3 13.7l-1.1 1.1",
  moon:    "M15.5 11.5A6 6 0 0 1 8.5 4.5a6 6 0 1 0 7 7Z",
  trash:   "M4.5 6h11M8 6V4.5h4V6M6 6l.6 9.5h6.8L14 6",
  pencil:  "M13.2 4.3l2.5 2.5M4 16l.7-3 8.5-8.5 2.3 2.3L7 15.3 4 16Z",
  check:   "M4.5 10.5l3.5 3.5 7.5-8",
  x:       "M5 5l10 10M15 5L5 15",
  panel:   "M3.5 4.5h13v11h-13zM8 4.5v11",
  panelOpen:"M3.5 4.5h13v11h-13zM7.5 4.5v11M11 8l2 2-2 2",
  grip:    "M7 6h.01M7 10h.01M7 14h.01M12 6h.01M12 10h.01M12 14h.01",
  doc:     "M5.5 3.5h6L15 7v9.5h-9.5zM11 3.5V7h3.5",
  info:    "M10 9v4.5M10 6.4v.1M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  ok:      "M4.5 10.5l3.5 3.5 7.5-8",
  warn:    "M10 7v4M10 13.5v.1M10 3l7.5 13H2.5L10 3Z",
  link:    "M8 11a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-1 1M12 9a3 3 0 0 0-4.2 0l-2 2A3 3 0 0 0 10 15.2l1-1",
  cube:    "M10 3l6 3.4v6.9L10 17l-6-3.7V6.4L10 3ZM4 6.5l6 3.5 6-3.5M10 10v7",
  hash:    "M7 3l-1 14M14 3l-1 14M4 7.5h12M3.5 12.5h12",
};
function Icon({ name, size = 18, stroke = 1.6, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      style={style} className={className} aria-hidden="true">
      <path d={ICON[name]} />
    </svg>
  );
}

/* ---------- type badge ---------- */
const TYPE_LABEL = { product: "プロダクト", feature: "機能", api: "API", screen: "画面", term: "用語", model: "モデル" };
function Badge({ type }) {
  return <span className={"badge " + type}>{TYPE_LABEL[type] || type}</span>;
}

/* ---------- frontmatter meta block ---------- */
function MetaBlock({ front }) {
  const keys = Object.keys(front);
  if (!keys.length) return null;
  return (
    <div className="meta">
      <div className="meta-head"><Icon name="info" size={14} /> frontmatter</div>
      <dl className="meta-grid">
        {keys.map((k) => {
          const v = front[k];
          return (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>
                {k === "status" ? (
                  <span className="status-pill"><span className="dot" />{v}</span>
                ) : Array.isArray(v) ? (
                  v.length ? v.join(", ") : "—"
                ) : (
                  String(v)
                )}
              </dd>
            </React.Fragment>
          );
        })}
      </dl>
    </div>
  );
}

/* ---------- mermaid ---------- */
function mermaidVars(theme) {
  if (theme === "dark") {
    return {
      background: "transparent",
      primaryColor: "#2b2f3b", primaryBorderColor: "#474d5e", primaryTextColor: "#e7e8ec",
      secondaryColor: "#323644", tertiaryColor: "#323644",
      lineColor: "#838aa0", textColor: "#c8cad4", classText: "#e7e8ec",
      fontSize: "13px",
    };
  }
  return {
    background: "transparent",
    primaryColor: "#ffffff", primaryBorderColor: "#cdcdc8", primaryTextColor: "#2b2b2a",
    secondaryColor: "#f3f3f1", tertiaryColor: "#f3f3f1",
    lineColor: "#9a9a92", textColor: "#3a3a38", classText: "#2b2b2a",
    fontSize: "13px",
  };
}
function Mermaid({ code, theme }) {
  const [svg, setSvg] = useState(null);
  useEffect(() => {
    let dead = false;
    const id = "mmd-" + Math.random().toString(36).slice(2, 9);
    try {
      window.mermaid.initialize({
        startOnLoad: false, theme: "base", securityLevel: "loose",
        themeVariables: mermaidVars(theme),
        fontFamily: '"IBM Plex Sans JP", system-ui, sans-serif',
        class: { useMaxWidth: true },
      });
      window.mermaid.render(id, code).then((r) => { if (!dead) setSvg(r.svg); })
        .catch((e) => { if (!dead) setSvg('<div style="color:var(--danger);font-family:monospace;font-size:12px">' + (e.message || "mermaid error") + "</div>"); });
    } catch (e) { setSvg("<div>mermaid unavailable</div>"); }
    return () => { dead = true; };
  }, [code, theme]);
  if (svg == null) return <div className="mermaid-wrap"><div className="skel" style={{ width: "60%", height: 180 }} /></div>;
  return <div className="mermaid-wrap" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/* ---------- markdown ---------- */
let _markedReady = false;
function ensureMarked() {
  if (_markedReady || !window.marked) return;
  window.marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });
  _markedReady = true;
}
// show HTML comments as faint annotations instead of hiding them
function preprocess(md) {
  return md.replace(/<!--([\s\S]*?)-->/g, (_, c) =>
    c.trim() ? `\n\n<p class="md-comment">// ${c.trim()}</p>\n\n` : ""
  );
}
function MarkdownView({ body, theme }) {
  ensureMarked();
  // split out mermaid fences so we can render them as diagrams
  const segments = useMemo(() => {
    const out = [];
    const re = /```mermaid\n([\s\S]*?)```/g;
    let last = 0, m;
    while ((m = re.exec(body))) {
      if (m.index > last) out.push({ t: "md", v: body.slice(last, m.index) });
      out.push({ t: "mermaid", v: m[1] });
      last = re.lastIndex;
    }
    if (last < body.length) out.push({ t: "md", v: body.slice(last) });
    return out;
  }, [body]);

  return (
    <div className="md">
      {segments.map((s, i) =>
        s.t === "mermaid"
          ? <Mermaid key={i} code={s.v} theme={theme} />
          : <div key={i} dangerouslySetInnerHTML={{ __html: window.marked.parse(preprocess(s.v)) }} />
      )}
    </div>
  );
}

window.SpecsLib = { Icon, Badge, MetaBlock, MarkdownView, Mermaid, TYPE_LABEL };
