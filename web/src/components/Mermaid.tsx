import { useEffect, useState } from "react";
import mermaid from "mermaid";

let counter = 0;

function mermaidVars(theme: string) {
  if (theme === "dark") {
    return {
      background: "transparent",
      primaryColor: "#2b2f3b",
      primaryBorderColor: "#474d5e",
      primaryTextColor: "#e7e8ec",
      secondaryColor: "#323644",
      tertiaryColor: "#323644",
      lineColor: "#838aa0",
      textColor: "#c8cad4",
      classText: "#e7e8ec",
      fontSize: "13px",
    };
  }
  return {
    background: "transparent",
    primaryColor: "#ffffff",
    primaryBorderColor: "#cdcdc8",
    primaryTextColor: "#2b2b2a",
    secondaryColor: "#f3f3f1",
    tertiaryColor: "#f3f3f1",
    lineColor: "#9a9a92",
    textColor: "#3a3a38",
    classText: "#2b2b2a",
    fontSize: "13px",
  };
}

// mermaid コードを SVG に描画する。テーマ変更時は再レンダリングする。
export function Mermaid({ code, theme }: { code: string; theme: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = `mmd-${counter++}`;
    setError(null);
    setSvg(null);
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        themeVariables: mermaidVars(theme),
        fontFamily: '"IBM Plex Sans JP", system-ui, sans-serif',
      });
      mermaid
        .render(id, code)
        .then((res) => {
          if (!cancelled) setSvg(res.svg);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        });
    } catch (e) {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    }
    return () => {
      cancelled = true;
    };
  }, [code, theme]);

  if (error) return <div className="mermaid-err">mermaid 描画エラー{"\n"}{error}</div>;
  if (svg == null)
    return (
      <div className="mermaid-wrap">
        <div className="skel" style={{ width: "60%", height: 180 }} />
      </div>
    );
  return <div className="mermaid-wrap" dangerouslySetInnerHTML={{ __html: svg }} />;
}
