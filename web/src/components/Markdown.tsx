import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Mermaid } from "./Mermaid";

// ```mermaid フェンスは Mermaid で描画し、それ以外の code はそのまま表示する。
const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    if (match?.[1] === "mermaid") {
      return <Mermaid code={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  // mermaid 図はそのまま (pre で囲わない)、通常のコードブロックは pre を維持する。
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

// frontmatter (先頭の --- ... ---) を分離して返す。
function splitFrontmatter(src: string): { frontmatter: string | null; body: string } {
  const normalized = src.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { frontmatter: null, body: normalized };
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) return { frontmatter: null, body: normalized };
  const frontmatter = normalized.slice(4, end);
  const body = normalized.slice(end + 4).replace(/^\n/, "");
  return { frontmatter, body };
}

export function Markdown({ content }: { content: string }) {
  const { frontmatter, body } = splitFrontmatter(content);
  return (
    <div className="md">
      {frontmatter !== null && (
        <div className="frontmatter">
          {frontmatter.split("\n").map((line, i) => {
            const idx = line.indexOf(":");
            if (idx < 0) return <div key={i}>{line}</div>;
            return (
              <div key={i}>
                <b>{line.slice(0, idx)}</b>
                {line.slice(idx)}
              </div>
            );
          })}
        </div>
      )}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  );
}
