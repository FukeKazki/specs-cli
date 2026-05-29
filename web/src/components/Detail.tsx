import { useEffect, useState } from "react";
import { api } from "../api";
import type { SpecDetail } from "../types";
import { Markdown } from "./Markdown";

export interface DetailProps {
  id: string;
  onSaved: () => void;
  onDeleted: () => void;
  onError: (message: string) => void;
  onToast: (message: string) => void;
}

export function Detail({ id, onSaved, onDeleted, onError, onToast }: DetailProps) {
  const [detail, setDetail] = useState<SpecDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setLoadError(null);
    setEditing(false);
    api
      .get(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadError) return <div className="empty">{loadError}</div>;
  if (!detail) return <div className="empty">読み込み中...</div>;

  const { spec, content } = detail;

  const startEdit = () => {
    setDraft(content);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.update(id, draft);
      setDetail({ spec, content: draft });
      setEditing(false);
      onSaved();
      onToast("保存しました");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`${spec.feature}/${spec.file} を削除しますか?`)) return;
    try {
      await api.remove(id);
      onDeleted();
      onToast("削除しました");
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <>
      <div className="crumb">
        features / {spec.feature} / {spec.file}
      </div>

      {editing ? (
        <>
          <div className="toolbar">
            <button className="primary" onClick={save} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={() => setEditing(false)}>キャンセル</button>
          </div>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />
        </>
      ) : (
        <>
          <div className="toolbar">
            <button className="primary" onClick={startEdit}>
              編集
            </button>
            <div className="spacer" />
            <button className="danger" onClick={remove}>
              削除
            </button>
          </div>
          <Markdown content={content} />
        </>
      )}
    </>
  );
}
