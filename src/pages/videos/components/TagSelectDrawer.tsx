// FILE: src/pages/videos/components/TagSelectDrawer.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { RiCloseLine, RiSearchLine, RiCheckboxCircleFill, RiCheckboxBlankCircleLine } from 'react-icons/ri';

export type TagItem = { tag: string; count: number };

function normalizeTags(tags: string[]) {
  return Array.from(new Set(tags.map(t => t.trim().toLowerCase()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
}

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;

  allTags: TagItem[];
  isLoading?: boolean;

  selectedTags: string[];
  onApply: (nextTags: string[]) => Promise<void> | void;
};

const TagSelectDrawer: React.FC<Props> = ({
  open,
  onClose,
  title = 'Select tags',
  allTags,
  isLoading = false,
  selectedTags,
  onApply,
}) => {
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<string[]>(() => normalizeTags(selectedTags));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setDraft(normalizeTags(selectedTags));
  }, [open, selectedTags]);

  const draftSet = useMemo(() => new Set(draft), [draft]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return allTags;
    return allTags.filter(({ tag }) => tag.toLowerCase().includes(s));
  }, [allTags, q]);

  const toggle = (tag: string) => {
    setDraft(prev => {
      const set = new Set(prev);
      const t = tag.trim().toLowerCase();
      if (set.has(t)) set.delete(t);
      else set.add(t);
      return normalizeTags(Array.from(set));
    });
  };

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onApply(normalizeTags(draft));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-bg-panel border-l border-border shadow-2xl flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div className="font-semibold">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/5 border border-border"
            aria-label="Close"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        <div className="p-4 border-b border-border">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <RiSearchLine className="text-text-dim" />
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tags..."
              className="w-full bg-zinc-950/30 border border-border rounded-xl pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-accent/50"
            />
          </div>

          <div className="mt-3 text-xs text-text-dim">
            Selected: <span className="text-text-main">{draft.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="p-4 text-sm text-text-dim">Loading tags...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-text-dim">No tags</div>
          ) : (
            <ul className="space-y-1">
              {filtered.map(({ tag, count }) => {
                const checked = draftSet.has(tag);
                return (
                  <li key={tag}>
                    <button
                      type="button"
                      onClick={() => toggle(tag)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {checked ? (
                          <RiCheckboxCircleFill className="text-accent text-lg flex-shrink-0" />
                        ) : (
                          <RiCheckboxBlankCircleLine className="text-text-dim text-lg flex-shrink-0" />
                        )}
                        <div className="text-sm text-text-main truncate">#{tag}</div>
                      </div>
                      <div className="text-xs text-text-dim flex-shrink-0">{count}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setDraft([])}
            className="px-3 py-2 rounded-xl border border-border hover:border-accent/50 text-sm"
          >
            Clear
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border hover:border-accent/50 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-accent/50 bg-accent/10 hover:bg-accent/15 text-sm disabled:opacity-60"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagSelectDrawer;