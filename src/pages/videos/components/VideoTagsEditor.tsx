// FILE: src/pages/videos/components/VideoTagsEditor.tsx
import { useMemo, useState } from 'react';
import type { Video } from '../../../types/domain';
import { db } from '../../../db/client';
import TagChip from '../../../components/TagChip';

type Props = {
  video: Video;
};

function normalizeTag(t: string): string {
  return t.trim().toLowerCase();
}

export default function VideoTagsEditor({ video }: Props) {
  const [input, setInput] = useState('');

  const tags = useMemo(() => (video.tags ?? []).slice().sort((a, b) => a.localeCompare(b)), [video.tags]);

  const applyTags = async (next: string[]) => {
    // 重複排除・空排除
    const cleaned = Array.from(new Set(next.map(normalizeTag))).filter(Boolean);
    await db.videos.update(video.id, { tags: cleaned });
  };

  const addFromInput = async () => {
    const raw = input.trim();
    if (!raw) return;

    // "a,b c" みたいなのも雑に追加できるように
    const parts = raw.split(/[,\s]+/g).map(normalizeTag).filter(Boolean);
    const next = Array.from(new Set([...(video.tags ?? []), ...parts]));
    setInput('');
    await applyTags(next);
  };

  const removeTag = async (t: string) => {
    const next = (video.tags ?? []).filter((x) => x !== t);
    await applyTags(next);
  };

  return (
    <div className="rounded-2xl border border-border bg-bg-panel p-4 space-y-3">
      <div className="text-sm font-semibold">Tags</div>

      <div className="flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <div className="text-sm text-text-dim">No tags</div>
        ) : (
          tags.map((t) => (
            <TagChip key={t} label={`#${t}`} isSelected onRemove={() => removeTag(t)} size="sm" />
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addFromInput();
          }}
          placeholder="add tags (comma/space separated)"
          className="flex-1 bg-bg-panel border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent/50"
        />
        <button
          type="button"
          onClick={addFromInput}
          className="rounded-xl border border-border bg-bg-panel px-3 py-2 text-sm hover:border-accent/50 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
