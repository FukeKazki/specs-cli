import { useEffect, useRef, useState } from "react";

export interface ModalProps {
  title: string;
  hint: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}

export function Modal({ title, hint, placeholder, onSubmit, onClose }: ModalProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{title}</h2>
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="hint">{hint}</div>
        <div className="actions">
          <button onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={submit}>
            作成
          </button>
        </div>
      </div>
    </div>
  );
}
