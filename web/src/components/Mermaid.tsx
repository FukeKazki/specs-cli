import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });

let counter = 0;

// mermaid コードを SVG に描画する。エラー時はソースとメッセージを表示する。
export function Mermaid({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${counter++}`);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    mermaid
      .render(idRef.current, code)
      .then((res) => {
        if (!cancelled) setSvg(res.svg);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="mermaid-error">
        <strong>mermaid 描画エラー</strong>
        <pre>{error}</pre>
        <pre>{code}</pre>
      </div>
    );
  }
  return <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />;
}
