import type { Spec } from "../types";
import type { Front } from "../lib/frontmatter";
import { parseActions } from "../lib/actions";
import { Badge, Icon, STATUS_LABEL, STATUS_OPTIONS } from "./ui";

export interface InfoPanelProps {
  selected: Spec;
  front: Front;
  body: string;
  open: boolean;
  onRelated: (ref: string) => void;
  onStatusChange: (status: string) => void;
  onAddAction: () => void;
}

function screenNumber(s: Spec): string {
  const m = s.file.match(/^(S-\d+)/);
  return m ? m[1] : s.file.replace(/\.md$/, "");
}

export function InfoPanel({ selected, front, body, open, onRelated, onStatusChange, onAddAction }: InfoPanelProps) {
  // 本文の H2/H3 から目次を組み立てる。
  const toc: { level: number; text: string }[] = [];
  const re = /^(##|###)\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) toc.push({ level: m[1].length, text: m[2].trim() });

  // Screen の Actions 実装状況 (チェックリスト集計, dashbaord)。
  const actions = selected.type === "screen" ? parseActions(body) : [];
  const doneCount = actions.filter((a) => a.done).length;

  const related = Array.isArray(front.related) ? front.related : [];
  const status = (typeof front.status === "string" && front.status) || selected.status;

  // type/status/related を除いた残りの単一値キー。
  const skip: Record<string, true> = { type: true, status: true, related: true };
  const extraKeys = Object.keys(front).filter((k) => !skip[k] && !Array.isArray(front[k]));

  const scrollToHeading = (text: string) => {
    const scroller = document.querySelector(".detail-scroll");
    const heads = document.querySelectorAll<HTMLElement>(".doc .md h2, .doc .md h3");
    heads.forEach((el) => {
      if (el.textContent?.trim() === text && scroller) {
        scroller.scrollTo({ top: el.offsetTop - 24, behavior: "smooth" });
      }
    });
  };

  return (
    <aside className={"info-rail scroll" + (open ? "" : " hidden")}>
      <div className="info-pad">
        <div className="info-railhead">
          <Icon name="info" size={14} /> 情報
        </div>

        <div className="info-block">
          <div className="info-label">種別</div>
          <Badge type={selected.type} />
        </div>

        {/* status は frontmatter に保存できる (S-002: サイドバーで変更)。 */}
        <div className="info-block">
          <div className="info-label">ステータス</div>
          <select
            className="info-status"
            value={status || ""}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">未設定</option>
            {[...STATUS_OPTIONS, ...(status && !STATUS_OPTIONS.includes(status) ? [status] : [])].map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s] || s}
              </option>
            ))}
          </select>
        </div>

        {selected.type === "screen" && (
          <div className="info-block">
            <div className="info-label">画面番号</div>
            <div className="info-row">
              <span className="v">
                {screenNumber(selected)} · 表示順 {selected.order}
              </span>
            </div>
          </div>
        )}

        {selected.type === "screen" && (
          <div className="info-block">
            <div className="info-label info-label-row">
              <span>操作</span>
              <button className="info-add" title="操作を追加" onClick={onAddAction}>
                <Icon name="plus" size={13} stroke={2} />
              </button>
            </div>
            {actions.length > 0 ? (
              <div className="action-progress">
                <div className="action-progress-head">
                  <span>
                    {doneCount} / {actions.length} 完了
                  </span>
                  <span className="pct mono">{Math.round((doneCount / actions.length) * 100)}%</span>
                </div>
                <div className="action-bar">
                  <div className="action-bar-fill" style={{ width: `${(doneCount / actions.length) * 100}%` }} />
                </div>
                <ul className="action-list">
                  {actions.map((a, i) => (
                    <li key={i} className={a.done ? "done" : ""}>
                      <Icon name={a.done ? "check" : "circle"} size={13} />
                      {a.id && <span className="aid mono">{a.id}</span>}
                      <span className="atext">{a.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="action-empty">操作がありません</div>
            )}
          </div>
        )}

        {extraKeys.length > 0 && (
          <div className="info-block">
            <div className="info-label">frontmatter</div>
            <div className="info-kv">
              {extraKeys.map((k) => (
                <div className="info-row" key={k}>
                  <span className="k">{k}</span>
                  <span className="v">{String(front[k])}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {related.length > 0 && (
          <div className="info-block">
            <div className="info-label">関連</div>
            <div className="info-related">
              {related.map((r, i) => (
                <a
                  key={i}
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onRelated(r);
                  }}
                >
                  <Icon name="link" size={13} /> {r}
                </a>
              ))}
            </div>
          </div>
        )}

        {toc.length > 0 && (
          <div className="info-block">
            <div className="info-label">目次</div>
            <div className="info-toc">
              {toc.map((h, i) => (
                <a
                  key={i}
                  className={h.level === 3 ? "h3" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToHeading(h.text);
                  }}
                >
                  {h.text}
                </a>
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
