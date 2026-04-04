import { useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiCloseLine, RiSearchLine } from 'react-icons/ri';
import type { ImageTagCategoryRecord, ImageTagRecord } from '../../../types/domain';
import { normalizeImageTagName } from '../../../services/imageService';

type Props = {
  categories: ImageTagCategoryRecord[];
  allTags: ImageTagRecord[];
  selectedTagIds: string[];
  recentTagIds: string[];
  onToggleTag: (tagId: string) => void;
  onCreateTag: (name: string, categoryId: string) => Promise<unknown>;
};

export default function ImageImportTagPicker({
  categories,
  allTags,
  selectedTagIds,
  recentTagIds,
  onToggleTag,
  onCreateTag,
}: Props) {
  const [query, setQuery] = useState('');
  const [newTagCategoryId, setNewTagCategoryId] = useState(
    categories.find((category) => category.protected)?.id ?? categories[0]?.id ?? '',
  );
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!newTagCategoryId && categories.length > 0) {
      setNewTagCategoryId(categories.find((category) => category.protected)?.id ?? categories[0].id);
    }
  }, [categories, newTagCategoryId]);

  const normalizedQuery = normalizeImageTagName(query);
  const selectedTags = useMemo(
    () => allTags.filter((tag) => selectedTagIds.includes(tag.id)),
    [allTags, selectedTagIds],
  );
  const recentTags = useMemo(
    () =>
      recentTagIds
        .map((tagId) => allTags.find((tag) => tag.id === tagId) ?? null)
        .filter((tag): tag is ImageTagRecord => Boolean(tag)),
    [allTags, recentTagIds],
  );
  const popularTags = useMemo(
    () => allTags.filter((tag) => !recentTagIds.includes(tag.id)).slice(0, 20),
    [allTags, recentTagIds],
  );
  const filteredTags = useMemo(
    () =>
      allTags.filter((tag) => {
        if (!normalizedQuery) return true;
        return tag.normalizedName.includes(normalizedQuery);
      }),
    [allTags, normalizedQuery],
  );

  const exactMatch = allTags.find((tag) => tag.normalizedName === normalizedQuery);
  const canCreate = normalizedQuery.length > 0 && !exactMatch && !!newTagCategoryId;

  const handleCreate = async () => {
    if (!canCreate || isCreating) return;
    setIsCreating(true);
    try {
      await onCreateTag(query.trim(), newTagCategoryId);
      setQuery('');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-bg-panel p-5">
      <h2 className="font-heading text-lg text-text-main">タグ</h2>
      <p className="mt-1 text-sm text-text-dim">選んだタグは、追加する画像すべてにまとめて付きます。</p>

      {selectedTags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs text-accent"
            >
              {tag.name}
              <RiCloseLine size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2">
        <RiSearchLine className="text-text-dim" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCreate();
          }}
          placeholder="タグを検索"
          className="flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-dim"
        />
      </div>

      {canCreate && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
          <RiAddLine className="text-accent" size={16} />
          <span className="flex-1 text-sm text-text-muted">
            「{query.trim()}」を新しいタグとして追加
          </span>
          <select
            value={newTagCategoryId}
            onChange={(event) => setNewTagCategoryId(event.target.value)}
            className="rounded-lg border border-border bg-bg-panel px-2 py-1 text-xs text-text-muted"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={isCreating}
            className="rounded-lg bg-accent px-3 py-1 text-xs text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      )}

      {recentTags.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-text-dim">最近使ったタグ</p>
          <div className="flex flex-wrap gap-2">
            {recentTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(tag.id)}
                disabled={selectedTagIds.includes(tag.id)}
                className={
                  selectedTagIds.includes(tag.id)
                    ? 'rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs text-accent'
                    : 'rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-main'
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {popularTags.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-text-dim">よく使うタグ</p>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggleTag(tag.id)}
                disabled={selectedTagIds.includes(tag.id)}
                className={
                  selectedTagIds.includes(tag.id)
                    ? 'rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs text-accent'
                    : 'rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-main'
                }
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {categories.map((category) => {
          const categoryTags = filteredTags.filter((tag) => tag.categoryId === category.id);
          if (categoryTags.length === 0) return null;

          return (
            <div key={category.id}>
              <p className="mb-2 text-xs text-text-dim">{category.name}</p>
              <div className="flex flex-wrap gap-2">
                {categoryTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => onToggleTag(tag.id)}
                    disabled={selectedTagIds.includes(tag.id)}
                    className={
                      selectedTagIds.includes(tag.id)
                        ? 'rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs text-accent'
                        : 'rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-main'
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
