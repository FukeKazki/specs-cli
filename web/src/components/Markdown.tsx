import { Children, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";
import { Mermaid } from "./Mermaid";
import { directiveToComponents } from "../lib/remarkDirective";
import { lineOffset, parseFront } from "../lib/frontmatter";

// MoSCoW 優先度 (specs-management R-010)。要件見出しの [Must] 等を色分けバッジにする。
// 表記ゆれ "Most" は Must の別名として許容する。
const PRIORITY: Record<string, { label: string; cls: string }> = {
  must: { label: "Must", cls: "prio-must" },
  most: { label: "Must", cls: "prio-must" },
  should: { label: "Should", cls: "prio-should" },
  could: { label: "Could", cls: "prio-could" },
  "won't": { label: "Won't", cls: "prio-wont" },
  "won’t": { label: "Won't", cls: "prio-wont" },
  wont: { label: "Won't", cls: "prio-wont" },
};

// 見出し先頭テキストから最初の [優先度] タグを取り出す (該当なしは null)。
function extractPriority(text: string): { prio: { label: string; cls: string } | null; text: string } {
  const m = text.match(/\[([^\]]+)\]/);
  if (m) {
    const info = PRIORITY[m[1].trim().toLowerCase()];
    if (info) {
      const rest = (text.slice(0, m.index) + text.slice(m.index! + m[0].length)).replace(/\s+/g, " ").trim();
      return { prio: info, text: rest };
    }
  }
  return { prio: null, text };
}

// HTML コメントを隠さず、薄い注釈 (// ...) として表示する。空コメントは除去する。
// 先頭にゼロ幅スペースを目印として付け、段落レンダラで .md-comment を当てる。
const COMMENT_MARK = "​";
function preprocess(md: string): string {
  return md.replace(/<!--([\s\S]*?)-->/g, (_all, c: string) =>
    c.trim() ? `\n\n${COMMENT_MARK}// ${c.trim()}\n\n` : "",
  );
}

// hast ノードからテキストを連結して取り出す (タスク項目のラベル抽出用)。
function hastText(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] } | undefined;
  if (!n) return "";
  if (n.type === "text") return n.value ?? "";
  if (Array.isArray(n.children)) return n.children.map(hastText).join("");
  return "";
}

// タスク項目 (li.task-list-item) のチェック状態を hast から読む。
function taskChecked(node: unknown): boolean {
  const n = node as { children?: { tagName?: string; properties?: { checked?: boolean } }[] } | undefined;
  const input = n?.children?.find((c) => c?.tagName === "input");
  return !!input?.properties?.checked;
}

// directive 系コンポーネントが受け取る props。属性 (id/type/…) は文字列で渡る。
interface DirectiveProps {
  id?: string;
  priority?: string;
  type?: string;
  title?: string;
  to?: string;
  children?: ReactNode;
}

export interface MarkdownProps {
  content: string;
  theme: string;
  // AI 参照コピー用 (R-011)。path は specs/ からのフルパス (例: specs/features/x/spec.md)。
  path?: string;
  onCopyRef?: (ref: string) => void;
  // タスクリストのチェック切り替え (Screen Actions の実装状況, dashbaord)。
  onToggleTask?: (label: string, checked: boolean) => void;
}

export function Markdown({ content, theme, path, onCopyRef, onToggleTask }: MarkdownProps) {
  // frontmatter は本文に出さない (右情報レールへ集約) が、行番号オフセットは保持する。
  const { body } = parseFront(content);
  const offset = lineOffset(content, body);
  const source = useMemo(() => preprocess(body), [body]);

  const components: Components = useMemo(() => {
    // 見出し: 先頭の [Must] 等を優先度バッジに、行番号を AI 参照コピーボタンにする。
    const heading =
      (Tag: "h1" | "h2" | "h3" | "h4") =>
      ({ node, children }: { node?: { position?: { start?: { line?: number } } }; children?: ReactNode }) => {
        const nodes = Children.toArray(children);
        let prio: { label: string; cls: string } | null = null;
        let head: ReactNode = children;
        if (typeof nodes[0] === "string") {
          const r = extractPriority(nodes[0]);
          prio = r.prio;
          head = prio ? [r.text, ...nodes.slice(1)] : children;
        }
        const line = node?.position?.start?.line;
        const ref = path && line != null ? `@${path} L${offset + line}` : null;
        return (
          <Tag>
            {head}
            {prio && <span className={`prio ${prio.cls}`}>{prio.label}</span>}
            {ref && onCopyRef && (
              <button type="button" className="copy-ref" title={`AI 参照をコピー: ${ref}`} onClick={() => onCopyRef(ref)}>
                🔗
              </button>
            )}
          </Tag>
        );
      };

    return {
      h1: heading("h1"),
      h2: heading("h2"),
      h3: heading("h3"),
      h4: heading("h4"),
      // ゼロ幅スペース始まりの段落は HTML コメント注釈として薄く表示する。
      p({ children }) {
        const nodes = Children.toArray(children);
        if (typeof nodes[0] === "string" && nodes[0].startsWith(COMMENT_MARK)) {
          return <p className="md-comment">{[nodes[0].slice(1), ...nodes.slice(1)]}</p>;
        }
        return <p>{children}</p>;
      },
      // ```mermaid フェンスは Mermaid で描画し、それ以外の code はそのまま表示する。
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || "");
        if (match?.[1] === "mermaid") {
          return <Mermaid code={String(children).replace(/\n$/, "")} theme={theme} />;
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      // タスクリスト項目: チェックボックスをクリック可能にして切り替えを通知する。
      li({ node, children, className }) {
        const isTask = typeof className === "string" && className.includes("task-list-item");
        if (!isTask || !onToggleTask) {
          return <li className={className}>{children}</li>;
        }
        const checked = taskChecked(node);
        const label = hastText(node).trim();
        // react-markdown が生成する元の disabled チェックボックスは除き、独自のものを描く。
        const rest = Children.toArray(children).filter(
          (c) => !(c != null && typeof c === "object" && "type" in c && (c as { type?: unknown }).type === "input"),
        );
        return (
          <li className={className + " md-task"}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggleTask(label, !checked)}
            />
            <span>{rest}</span>
          </li>
        );
      },
      // mermaid 図は pre で囲わない、通常のコードブロックは pre を維持する。
      pre({ children }) {
        if (
          Array.isArray(children) === false &&
          // @ts-expect-error react-markdown が渡す element の props を覗く
          children?.props?.className?.includes?.("language-mermaid")
        ) {
          return <>{children}</>;
        }
        return <pre>{children}</pre>;
      },
      // :::requirement{id=R-001 priority=must} 本文 ::: → 要件カード。
      // priority は見出しバッジと同じ MoSCoW 配色 (prio-*) を流用する。
      "directive-requirement": ({ id, priority, children }: DirectiveProps) => {
        const info = priority ? PRIORITY[priority.toLowerCase()] : null;
        return (
          <div className="dir-req">
            <div className="dir-req-head">
              {id && <span className="dir-req-id mono">{id}</span>}
              {info && <span className={`prio ${info.cls}`}>{info.label}</span>}
            </div>
            <div className="dir-req-body">{children}</div>
          </div>
        );
      },
      // :::note{type=warn|info|tip} 本文 ::: → 注記ボックス (既定 info)。
      "directive-note": ({ type, children }: DirectiveProps) => {
        const kind = type && ["info", "warn", "tip"].includes(type) ? type : "info";
        return (
          <aside className={`dir-note dir-note-${kind}`}>
            <div className="dir-note-body">{children}</div>
          </aside>
        );
      },
      // :::acceptance{title=…} 本文 ::: → 受け入れ条件ボックス。
      // 中のタスクリストは既存の li オーバーライド (onToggleTask) がそのまま効く。
      "directive-acceptance": ({ title, children }: DirectiveProps) => (
        <section className="dir-accept">
          <div className="dir-accept-head">{title || "受け入れ条件"}</div>
          <div className="dir-accept-body">{children}</div>
        </section>
      ),
      // :badge[ラベル]{type=…} → インラインバッジ。
      "directive-badge": ({ type, children }: DirectiveProps) => (
        <span className={`dir-badge dir-badge-${type || "default"}`}>{children}</span>
      ),
      // ::screen-ref[ラベル]{to=screens/S-001-login.md} → 画面への相互リンク。
      // 行頭のリーフ (::) はブロック、行内では :screen-ref[…]{…} (テキスト) を使う。
      // 相対 href として描き、Detail の onDocClick が SPA 遷移へ解決する。
      "directive-screen-ref": ({ to, children }: DirectiveProps) => {
        const nodes = Children.toArray(children);
        const label = nodes.length ? children : (to ?? "").split("/").pop();
        return (
          <a className="dir-screen-ref" href={to || "#"}>
            <span className="dir-screen-ref-ico">▤</span>
            {label}
          </a>
        );
      },
    } as Components;
  }, [path, offset, onCopyRef, theme, onToggleTask]);

  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkDirective, directiveToComponents]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
