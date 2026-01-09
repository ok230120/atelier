// FILE: src/components/InlineTitleEditor.tsx
import { useEffect, useState } from "react";
import { RiPencilLine, RiCheckLine, RiCloseLine, RiDeleteBinLine } from "react-icons/ri";

type Props = {
  value?: string;
  fallback: string;
  onSave: (next: string) => Promise<void> | void;
  onClear: () => Promise<void> | void;
  compact?: boolean; // 小さいサイズで表示するためのフラグを追加
};

export default function InlineTitleEditor({ value, fallback, onSave, onClear, compact = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const display = (value ?? "").trim() ? (value ?? "").trim() : fallback;

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <span 
          className={`${compact ? "text-sm font-medium" : "text-2xl font-bold"} leading-tight text-text-main break-words flex-1`}
        >
          {display}
        </span>
        <button
          type="button"
          className="p-1 rounded-lg border border-border bg-bg-panel hover:border-accent/50 text-text-dim hover:text-accent transition-colors opacity-0 group-hover:opacity-100"
          onClick={() => setEditing(true)}
          title="タイトルを編集"
        >
          <RiPencilLine size={compact ? 14 : 20} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 w-full bg-bg-panel ${compact ? "p-1.5" : "p-3"} rounded-xl border border-accent/30 shadow-sm`}>
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className={`w-full bg-bg-surface border border-border rounded-lg px-2 py-1 ${compact ? "text-sm font-medium" : "text-lg font-bold"} focus:outline-none focus:border-accent`}
        placeholder={fallback}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <div className="flex justify-end gap-1">
        <button
          className="p-1 rounded hover:bg-red-400/10 text-text-dim hover:text-red-400"
          onClick={async () => {
            if(confirm("カスタムタイトルを削除しますか？")) {
              await onClear();
              setEditing(false);
            }
          }}
          title="元に戻す"
        >
          <RiDeleteBinLine size={16} />
        </button>
        <div className="flex-1" />
        <button className="p-1 rounded hover:bg-bg-surface text-text-dim" onClick={() => setEditing(false)}>
          <RiCloseLine size={18} />
        </button>
        <button
          className="p-1 rounded bg-accent text-white hover:bg-accent/90"
          onClick={async () => {
            await onSave(draft);
            setEditing(false);
          }}
        >
          <RiCheckLine size={18} />
        </button>
      </div>
    </div>
  );
}