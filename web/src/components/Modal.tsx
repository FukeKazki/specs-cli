import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

export type CreateKind = "feature" | "screen" | "requirement" | "term" | "model";

export interface ModalState {
  kind: CreateKind;
  feature?: string;
}

const CREATE_COPY: Record<CreateKind, { title: string; hint: string; placeholder: string }> = {
  feature: {
    title: "新規 feature",
    hint: "英数字 . _ - が使えます。spec.md が生成されます。",
    placeholder: "feature 名 (例: user-login)",
  },
  screen: {
    title: "画面を追加",
    hint: "画面名を入力。S-00n が自動採番され screens/ に生成されます。",
    placeholder: "画面名 (例: ログイン画面)",
  },
  requirement: {
    title: "要件を追加",
    hint: "要件名を入力。R-00n が自動採番され requirements/ に生成されます。",
    placeholder: "要件名 (例: ステータス管理)",
  },
  term: {
    title: "用語を追加",
    hint: "ユビキタス言語を domain/glossary/ に作成します。",
    placeholder: "用語名 (例: 仕様書)",
  },
  model: {
    title: "モデルを追加",
    hint: "mermaid 記法のモデルを domain/models/ に作成します。",
    placeholder: "モデル名 (例: User)",
  },
};

export interface ModalProps {
  modal: ModalState;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export function Modal({ modal, onSubmit, onClose }: ModalProps) {
  const copy = CREATE_COPY[modal.kind];
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title =
    (modal.kind === "screen" || modal.kind === "requirement") && modal.feature
      ? `${copy.title} — ${modal.feature}`
      : copy.title;
  const submit = () => {
    const v = name.trim();
    if (v) onSubmit(v);
  };

  // 生成ファイルのライブプレビュー。
  const preview = (() => {
    const n = name.trim() || "…";
    switch (modal.kind) {
      case "feature":
        return [`features/${n}/spec.md`];
      case "screen":
        return [`features/${modal.feature}/screens/S-00n.md`];
      case "requirement":
        return [`features/${modal.feature}/requirements/R-00n.md`];
      case "term":
        return [`domain/glossary/${n}.md`];
      case "model":
        return [`domain/models/${n}.md`];
    }
  })();

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <p className="hint">{copy.hint}</p>
        </div>
        <div className="modal-body">
          <label className="input-label">名前</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            placeholder={copy.placeholder}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <div className="gen-preview">
            {preview.map((p, i) => (
              <div className="ln" key={i}>
                <span className="plus">+</span> <span>{p}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>
            キャンセル
          </button>
          <button className="btn primary" disabled={!name.trim()} onClick={submit}>
            <Icon name="plus" size={15} stroke={2} /> 作成
          </button>
        </div>
      </div>
    </div>
  );
}
