import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type { Spec } from "./types";
import { Sidebar } from "./components/Sidebar";
import { Detail } from "./components/Detail";
import { Modal } from "./components/Modal";

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

type ModalState =
  | { mode: "feature" }
  | { mode: "screen"; feature: string }
  | { mode: "term" }
  | { mode: "model" }
  | null;

function modalText(modal: NonNullable<ModalState>): {
  title: string;
  hint: string;
  placeholder: string;
} {
  switch (modal.mode) {
    case "feature":
      return {
        title: "新規 feature",
        hint: "英数字 . _ - が使えます。spec.md と api.md が生成されます。",
        placeholder: "feature 名 (例: user-login)",
      };
    case "screen":
      return {
        title: `画面を追加 — ${modal.feature}`,
        hint: "画面名を入力。S-00n が自動採番され screens/ に生成されます。",
        placeholder: "画面名 (例: ログイン画面)",
      };
    case "term":
      return {
        title: "用語を追加",
        hint: "ユビキタス言語を domain/glossary/ に作成します。",
        placeholder: "用語名 (例: 仕様書)",
      };
    case "model":
      return {
        title: "モデルを追加",
        hint: "mermaid 記法のモデルを domain/models/ に作成します。",
        placeholder: "モデル名 (例: User)",
      };
  }
}

export function App() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [activeId, navigate] = useHashId();
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((cur) => (cur === message ? null : cur)), 2200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setSpecs(await api.list());
    } catch (e) {
      showToast((e as Error).message);
    }
  }, [showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
        showToast("並び順を保存しました");
      } catch (e) {
        showToast((e as Error).message);
        refresh();
      }
    },
    [refresh, showToast],
  );

  const submitModal = useCallback(
    async (value: string) => {
      try {
        let focusId: string | undefined;
        if (modal?.mode === "feature") {
          const res = await api.createFeature(value);
          focusId = res.created?.[0];
          showToast(`feature "${value}" を作成しました`);
        } else if (modal?.mode === "screen") {
          const res = await api.createScreen(modal.feature, value);
          focusId = res.created;
          showToast(`画面 "${value}" を作成しました`);
        } else if (modal?.mode === "term") {
          const res = await api.createTerm(value);
          focusId = res.created;
          showToast(`用語 "${value}" を作成しました`);
        } else if (modal?.mode === "model") {
          const res = await api.createModel(value);
          focusId = res.created;
          showToast(`モデル "${value}" を作成しました`);
        }
        setModal(null);
        await refresh();
        if (focusId) navigate(focusId);
      } catch (e) {
        showToast((e as Error).message);
      }
    },
    [modal, navigate, refresh, showToast],
  );

  return (
    <>
      <header>
        <h1>📑 specs</h1>
        <div className="spacer" />
        <button className="primary" onClick={() => setModal({ mode: "feature" })}>
          + 新規 feature
        </button>
      </header>

      <div className="layout">
        <Sidebar
          specs={specs}
          activeId={activeId}
          onSelect={navigate}
          onAddScreen={(feature) => setModal({ mode: "screen", feature })}
          onReorderScreens={reorderScreens}
          onAddTerm={() => setModal({ mode: "term" })}
          onAddModel={() => setModal({ mode: "model" })}
        />
        <main className="main">
          {activeId ? (
            <Detail
              key={activeId}
              id={activeId}
              onSaved={refresh}
              onDeleted={() => {
                navigate("");
                refresh();
              }}
              onError={showToast}
              onToast={showToast}
            />
          ) : (
            <div className="empty">左の一覧から仕様書を選択してください</div>
          )}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {modal && (
        <Modal
          title={modalText(modal).title}
          hint={modalText(modal).hint}
          placeholder={modalText(modal).placeholder}
          onSubmit={submitModal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
