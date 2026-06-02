import { useEffect, useState } from "react";
import { api } from "../../api";
import type { Spec } from "../../types";
import { groupKeyOf, statusColorVar, statusLabel } from "../../lib/pm";
import { Icon, PriorityTag } from "../ui";
import { Markdown } from "../Markdown";

export interface PMDetailPanelProps {
  spec: Spec; // メタは一覧から (App が同期) 取得し、本文だけ fetch する
  theme: string;
  onClose: () => void;
  onOpenDoc: (id: string) => void;
}

// PM ビュー右側の要件詳細パネル (R-011)。選択した要件の本文とメタを表示する。
export function PMDetailPanel({ spec, theme, onClose, onOpenDoc }: PMDetailPanelProps) {
  const [content, setContent] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setErr(null);
    api
      .get(spec.id)
      .then((d) => {
        if (!cancelled) setContent(d.content);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [spec.id]);

  return (
    <aside className="pm-detail">
      <div className="pm-detail-head">
        <span className="pm-detail-id mono">{spec.id}</span>
        <span className="grow" />
        <button className="btn ghost" onClick={() => onOpenDoc(spec.id)} title="ドキュメントで開く">
          <Icon name="link" size={13} /> ドキュメント
        </button>
        <button className="icon-btn" onClick={onClose} title="閉じる">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="pm-detail-body scroll">
        <div className="pm-detail-meta">
          {spec.priority && <PriorityTag priority={spec.priority} />}
          <span className="status-pill">
            <span className="dot" style={{ background: statusColorVar(spec.status || "") }} />
            {statusLabel(spec.status || "")}
          </span>
        </div>

        <div className="pm-detail-kv">
          <div>
            <span className="k">feature</span>
            <span className="v mono">{groupKeyOf(spec)}</span>
          </div>
          <div>
            <span className="k">担当</span>
            <span className="v">{spec.assignee || "—"}</span>
          </div>
          <div>
            <span className="k">期間</span>
            <span className="v mono">
              {spec.start || "—"} 〜 {spec.due || "—"}
            </span>
          </div>
          {spec.dependsOn && spec.dependsOn.length > 0 && (
            <div>
              <span className="k">依存</span>
              <span className="v mono">{spec.dependsOn.join(", ")}</span>
            </div>
          )}
        </div>

        {err ? (
          <div className="pm-detail-err">
            <Icon name="warn" size={14} /> {err}
          </div>
        ) : content == null ? (
          <div className="pm-detail-skel">
            <div className="skel" style={{ height: 24, width: "60%", marginBottom: 14 }} />
            <div className="skel" style={{ height: 14, width: "92%", marginBottom: 8 }} />
            <div className="skel" style={{ height: 14, width: "80%" }} />
          </div>
        ) : (
          <div className="doc">
            <Markdown content={content} theme={theme} path={`specs/${spec.id}`} />
          </div>
        )}
      </div>
    </aside>
  );
}
