import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Spec } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Detail } from "./components/Detail";
import { Modal, type ModalState } from "./components/Modal";
import { Icon } from "./components/ui";

// 選択中の仕様書 ID を URL ハッシュで保持する。
function useHashId(): [string, (id: string) => void] {
  const [id, setId] = useState(() => decodeURIComponent(location.hash.slice(1)));
  useEffect(() => {
    const onChange = () => setId(decodeURIComponent(location.hash.slice(1)));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = useCallback((next: string) => {
    location.hash = next ? encodeURIComponent(next) : "";
  }, []);
  return [id, navigate];
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

export function App() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [activeId, navigate] = useHashId();
  const [theme, toggleTheme] = useTheme();
  const [modal, setModal] = useState<ModalState | null>(null);
  const [sbOpen, setSbOpen] = useState(true);
  const [infoOpen, setInfoOpen] = useState(() => window.innerWidth > 1180);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
        <span className="path-hint mono">~/project/specs · 127.0.0.1:8787</span>
        <span className="grow" />
        <button className="icon-btn" title="テーマ切り替え" onClick={toggleTheme}>
          <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
        </button>
        <button className="btn primary" onClick={() => setModal({ kind: "feature" })}>
          <span className="kbd">
            <Icon name="plus" size={15} stroke={2} />
          </span>{" "}
          新規 feature
        </button>
      </div>

      <div className="body">
        <div className={"scrim-sb" + (mobileScrim ? " show" : "")} onClick={() => setSbOpen(false)} />
        <Sidebar
          specs={specs}
          activeId={activeId}
          open={sbOpen}
          onSelect={select}
          onAddFeature={() => setModal({ kind: "feature" })}
          onAddScreen={(feature) => setModal({ kind: "screen", feature })}
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
                <p>左の一覧から仕様書を選ぶか、「新規 feature」で作成してください。</p>
              </div>
            </div>
          </main>
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
