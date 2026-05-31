import { Children, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid";
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

export interface MarkdownProps {
  content: string;
  theme: string;
  // AI 参照コピー用 (R-011)。path は specs/ からのフルパス (例: specs/features/x/spec.md)。
  path?: string;
  onCopyRef?: (ref: string) => void;
}

export function Markdown({ content, theme, path, onCopyRef }: MarkdownProps) {
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
    };
  }, [path, offset, onCopyRef, theme]);

  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
