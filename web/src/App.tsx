import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Spec, SpecMeta } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Detail } from "./components/Detail";
import { Modal, type ModalState } from "./components/Modal";
import { PMView, type PMViewKind } from "./components/pm/PMView";
import { emptyFilters, type PMFilters } from "./lib/pm";
import { Icon } from "./components/ui";

type Mode = "docs" | "pm";
interface Route {
  mode: Mode;
  view: PMViewKind;
  id: string;
}
const PM_VIEWS: PMViewKind[] = ["list", "kanban", "gantt"];

// URL ハッシュをルートに解釈する。
//   ""/<id>      → ドキュメントモード (既存)
//   pm/<view>    → プロジェクト管理モード
function parseHash(): Route {
  const raw = decodeURIComponent(location.hash.slice(1));
  if (raw === "pm" || raw.startsWith("pm/")) {
    const v = raw.slice(3) as PMViewKind;
    return { mode: "pm", view: PM_VIEWS.includes(v) ? v : "list", id: "" };
  }
  return { mode: "docs", view: "list", id: raw };
}

function useHashRoute(): [Route, (id: string) => void, (view: PMViewKind) => void] {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const selectDoc = useCallback((id: string) => {
    location.hash = id ? encodeURIComponent(id) : "";
  }, []);
  const openPM = useCallback((view: PMViewKind) => {
    location.hash = "pm/" + view;
  }, []);
  return [route, selectDoc, openPM];
}

// 進捗メタの楽観更新マージ (省略フィールドは据え置き)。
function mergeMeta(s: Spec, m: SpecMeta): Spec {
  return {
    ...s,
    ...(m.status !== undefined ? { status: m.status } : {}),
    ...(m.assignee !== undefined ? { assignee: m.assignee } : {}),
    ...(m.start !== undefined ? { start: m.start } : {}),
    ...(m.due !== undefined ? { due: m.due } : {}),
    ...(m.dependsOn !== undefined ? { dependsOn: m.dependsOn } : {}),
  };
}

type Theme = "light" | "dark";
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("specs-theme") as Theme) || "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("specs-theme", theme);
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return [theme, toggle];
}

interface Toast {
  id: string;
  kind: "ok" | "err" | "info";
  msg: string;
  sub?: string;
  out?: boolean;
}

let toastSeq = 0;

// PM のフィルタ / グルーピングを localStorage に永続化する。
function usePMFilters(): [PMFilters, (f: PMFilters) => void, boolean, (g: boolean) => void] {
  const [filters, setFilters] = useState<PMFilters>(() => {
    try {
      return { ...emptyFilters, ...JSON.parse(localStorage.getItem("specs-pm-filters") || "{}") };
    } catch {
      return emptyFilters;
    }
  });
  const [groupByFeat, setGroupByFeat] = useState<boolean>(
    () => localStorage.getItem("specs-pm-group") === "1",
  );
  useEffect(() => {
    localStorage.setItem("specs-pm-filters", JSON.stringify(filters));
  }, [filters]);
  useEffect(() => {
    localStorage.setItem("specs-pm-group", groupByFeat ? "1" : "0");
  }, [groupByFeat]);
  return [filters, setFilters, groupByFeat, setGroupByFeat];
}

export function App() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [route, navigate, openPM] = useHashRoute();
  const activeId = route.id;
  const [theme, toggleTheme] = useTheme();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [sbOpen, setSbOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(() => window.innerWidth > 1180);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [filters, setFilters, groupByFeat, setGroupByFeat] = usePMFilters();

  const pushToast = useCallback((kind: Toast["kind"], msg: string, sub?: string) => {
    const id = `t${toastSeq++}`;
    setToasts((ts) => [...ts, { id, kind, msg, sub }]);
    window.setTimeout(() => setToasts((ts) => ts.map((x) => (x.id === id ? { ...x, out: true } : x))), 2600);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 2900);
  }, []);

  const okToast = useCallback((msg: string, sub?: string) => pushToast("ok", msg, sub), [pushToast]);
  const errToast = useCallback((msg: string, sub?: string) => pushToast("err", msg, sub), [pushToast]);

  const refresh = useCallback(async () => {
    try {
      setSpecs(await api.list());
    } catch (e) {
      errToast((e as Error).message);
    }
  }, [errToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const select = useCallback(
    (id: string) => {
      navigate(id);
      if (window.innerWidth <= 860) setSbOpen(false);
    },
    [navigate],
  );

  const reorderScreens = useCallback(
    async (feature: string, orderedIds: string[]) => {
      // 楽観的に並びを反映してからサーバへ保存する。
      setSpecs((prev) => {
        const rank = new Map(orderedIds.map((id, i) => [id, i]));
        return [...prev].sort((a, b) => {
          if (a.feature !== b.feature) return 0;
          const ra = rank.get(a.id);
          const rb = rank.get(b.id);
          if (ra === undefined || rb === undefined) return 0;
          return ra - rb;
        });
      });
      try {
        await api.reorderScreens(feature, orderedIds);
        await refresh();
        okToast("並び順を保存しました", feature);
      } catch (e) {
        errToast((e as Error).message);
        refresh();
      }
    },
    [refresh, okToast, errToast],
  );

  // 進捗メタを楽観更新で保存する。失敗時は元の状態へ戻す (かんばん/ガントの revert 要件)。
  const setMeta = useCallback(
    async (id: string, meta: SpecMeta) => {
      let prev: Spec[] = [];
      setSpecs((cur) => {
        prev = cur;
        return cur.map((s) => (s.id === id ? mergeMeta(s, meta) : s));
      });
      try {
        const { spec } = await api.setMeta(id, meta);
        setSpecs((cur) => cur.map((s) => (s.id === id ? spec : s)));
      } catch (e) {
        setSpecs(prev);
        errToast((e as Error).message);
        throw e;
      }
    },
    [errToast],
  );

  const submitModal = useCallback(
    async (value: string) => {
      if (!modal) return;
      try {
        let focusId: string | undefined;
        if (modal.kind === "feature") {
          const res = await api.createFeature(value);
          focusId = res.created?.[0];
          okToast("feature を作成しました", value);
        } else if (modal.kind === "screen" && modal.feature) {
          const res = await api.createScreen(modal.feature, value);
          focusId = res.created;
          okToast("画面を作成しました", value);
        } else if (modal.kind === "requirement" && modal.feature) {
          const res = await api.createRequirement(modal.feature, value);
          focusId = res.created;
          okToast("要件を作成しました", value);
        } else if (modal.kind === "term") {
          const res = await api.createTerm(value);
          focusId = res.created;
          okToast("用語を作成しました", value);
        } else if (modal.kind === "model") {
          const res = await api.createModel(value);
          focusId = res.created;
          okToast("モデルを作成しました", value);
        }
        setModal(null);
        await refresh();
        if (focusId) select(focusId);
      } catch (e) {
        errToast((e as Error).message);
      }
    },
    [modal, refresh, select, okToast, errToast],
  );

  const mobileScrim = sbOpen && window.innerWidth <= 860;

  return (
    <div className="app">
      <div className="topbar">
        <button className="icon-btn" title="サイドバー" onClick={() => setSbOpen((v) => !v)}>
          <Icon name={sbOpen ? "panel" : "panelOpen"} />
        </button>
        <div className="brand">
          <span className="glyph">§</span>
          <span className="name">
            spec<b>s</b>
          </span>
        </div>
        <div className="mode-switch" role="tablist" aria-label="モード切替">
          <button
            className={"mode-tab" + (route.mode === "docs" ? " on" : "")}
            onClick={() => navigate(activeId)}
          >
            <Icon name="doc" size={14} /> ドキュメント
          </button>
          <button
            className={"mode-tab" + (route.mode === "pm" ? " on" : "")}
            onClick={() => openPM(route.view)}
          >
            <Icon name="board" size={14} /> プロジェクト管理
          </button>
        </div>
        <span className="path-hint mono">~/project/specs · 127.0.0.1:8787</span>
        <span className="grow" />
        <button className="icon-btn" title="テーマ切り替え" onClick={toggleTheme}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
        </button>
      </div>

      <div className="body">
        {route.mode === "pm" ? (
          <PMView
            specs={specs}
            view={route.view}
            onView={openPM}
            filters={filters}
            onFilters={setFilters}
            groupByFeat={groupByFeat}
            onGroupByFeat={setGroupByFeat}
            onSelect={select}
            onSetMeta={setMeta}
            onToast={okToast}
            onError={errToast}
            theme={theme}
          />
        ) : (
          <>
            <div className={"scrim-sb" + (mobileScrim ? " show" : "")} onClick={() => setSbOpen(false)} />
            <Sidebar
              specs={specs}
              activeId={activeId}
              open={sbOpen}
              onSelect={select}
              onAddFeature={() => setModal({ kind: "feature" })}
              onAddScreen={(feature) => setModal({ kind: "screen", feature })}
              onAddRequirement={(feature) => setModal({ kind: "requirement", feature })}
              onAddTerm={() => setModal({ kind: "term" })}
              onAddModel={() => setModal({ kind: "model" })}
              onReorderScreens={reorderScreens}
            />

            {activeId ? (
              <Detail
                key={activeId}
                id={activeId}
                specs={specs}
                theme={theme}
                infoOpen={infoOpen}
                setInfoOpen={setInfoOpen}
                onNavigate={select}
                onSaved={refresh}
                onDeleted={() => {
                  navigate("");
                  refresh();
                }}
                onError={errToast}
                onToast={okToast}
              />
            ) : (
              <main className="main">
                <div className="empty">
                  <div className="empty-card">
                    <div className="ico">
                      <Icon name="doc" size={26} />
                    </div>
                    <h3>仕様書が選択されていません</h3>
                    <p>左の一覧から仕様書を選ぶか、「機能」グループの ＋ から作成してください。</p>
                  </div>
                </div>
              </main>
            )}
          </>
        )}
      </div>

      {modal && <Modal modal={modal} onSubmit={submitModal} onClose={() => setModal(null)} />}

      <div className="toasts">
        {toasts.map((t) => (
          <div className={"toast " + t.kind + (t.out ? " out" : "")} key={t.id}>
            <span className="ti">
              <Icon name={t.kind === "err" ? "warn" : "ok"} size={16} />
            </span>
            <div className="tx">
              <div>{t.msg}</div>
              {t.sub && <div className="sub mono">{t.sub}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
