import { useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiCloseLine, RiSearchLine } from 'react-icons/ri';
import type { ImageTagCategoryRecord, ImageTagRecord } from '../../../types/domain';
import {
  backfillImageTagReadings,
  getOrCreateImageTag,
  listImageTagCategories,
  listImageTags,
  matchesImageTagSearch,
  normalizeImageTagName,
} from '../../../services/imageService';

type Props = {
  mode: 'add' | 'remove';
  title?: string;
  currentTagIds?: string[];
  availableTagIds?: string[];
  usageCountOverride?: Record<string, number>;
  onSelect: (tag: ImageTagRecord) => void | Promise<void>;
  onClose: () => void;
};

export default function TagSelectorPanel({
  mode,
  title,
  currentTagIds = [],
  availableTagIds,
  usageCountOverride,
  onSelect,
  onClose,
}: Props) {
  const [categories, setCategories] = useState<ImageTagCategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<ImageTagRecord[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'ALL'>('ALL');
  const [newTagCategoryId, setNewTagCategoryId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([listImageTagCategories(), listImageTags()]).then(
      ([nextCategories, nextTags]) => {
        setCategories(nextCategories);
        setAllTags(nextTags);
        setNewTagCategoryId(
          nextCategories.find((category) => category.protected)?.id ?? nextCategories[0]?.id ?? '',
        );
      },
    );

    void backfillImageTagReadings()
      .then(() => listImageTags())
      .then((nextTags) => setAllTags(nextTags))
      .catch(() => undefined);
  }, []);

  const availableTagSet = useMemo(
    () => (availableTagIds ? new Set(availableTagIds) : null),
    [availableTagIds],
  );
  const currentTagSet = useMemo(() => new Set(currentTagIds), [currentTagIds]);
  const normalizedQuery = normalizeImageTagName(query);
  const exactMatch = allTags.find((tag) => tag.normalizedName === normalizedQuery);
  const canCreate = mode === 'add' && normalizedQuery.length > 0 && !exactMatch && !!newTagCategoryId;

  const filteredTags = useMemo(() => {
    return allTags.filter((tag) => {
      if (availableTagSet && !availableTagSet.has(tag.id)) return false;
      if (activeCategoryId !== 'ALL' && tag.categoryId !== activeCategoryId) return false;
      return matchesImageTagSearch(tag, query, normalizedQuery);
    });
  }, [activeCategoryId, allTags, availableTagSet, normalizedQuery, query]);

  const visibleCategories = useMemo(() => {
    if (activeCategoryId !== 'ALL') {
      return categories.filter((category) => category.id === activeCategoryId);
    }
    return categories.filter((category) =>
      filteredTags.some((tag) => tag.categoryId === category.id),
    );
  }, [activeCategoryId, categories, filteredTags]);

  const handleCreate = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      const tag = await getOrCreateImageTag(query.trim(), newTagCategoryId);
      setAllTags((prev) => [tag, ...prev.filter((item) => item.id !== tag.id)]);
      await onSelect(tag);
      setQuery('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-heading text-lg text-text-main">
            {title ?? (mode === 'add' ? 'タグを追加' : 'タグを外す')}
          </h3>
          <button onClick={onClose} className="text-text-dim transition-colors hover:text-text-main">
            <RiCloseLine size={22} />
          </button>
        </div>

        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2">
            <RiSearchLine className="text-text-dim" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canCreate) void handleCreate();
              }}
              placeholder={mode === 'add' ? 'タグを検索' : '外すタグを検索'}
              className="flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-dim"
              autoFocus
            />
          </div>
        </div>

        {canCreate && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
            <RiAddLine className="text-accent" size={16} />
            <span className="flex-1 text-sm text-text-muted">
              <span className="text-accent">{query.trim()}</span> を新規タグとして追加
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
              onClick={() => void handleCreate()}
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        )}

        <div className="px-5 pb-2 pt-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategoryId('ALL')}
              className={
                activeCategoryId === 'ALL'
                  ? 'rounded-full bg-accent px-3 py-1 text-xs text-white'
                  : 'rounded-full bg-bg-surface px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-main'
              }
            >
              すべて
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategoryId(category.id)}
                className={
                  activeCategoryId === category.id
                    ? 'rounded-full bg-accent px-3 py-1 text-xs text-white'
                    : 'rounded-full bg-bg-surface px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-main'
                }
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {visibleCategories.map((category) => {
            const tags = filteredTags.filter((tag) => tag.categoryId === category.id);
            if (tags.length === 0) return null;

            return (
              <div key={category.id} className="mb-4">
                <p className="mb-2 text-xs tracking-wider text-text-dim">{category.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const disabled = mode === 'add' && currentTagSet.has(tag.id);

                    return (
                      <button
                        key={tag.id}
                        onClick={() => void onSelect(tag)}
                        disabled={disabled}
                        className={
                          disabled
                            ? 'cursor-default rounded-full border border-accent/40 bg-accent/20 px-3 py-1.5 text-xs text-accent'
                            : 'rounded-full border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-muted transition-all hover:border-accent/50 hover:text-text-main'
                        }
                      >
                        {tag.name}
                        <span className="ml-1 opacity-60">
                          {usageCountOverride?.[tag.id] ?? tag.usageCount}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredTags.length === 0 && !canCreate && (
            <p className="py-8 text-center text-sm text-text-dim">
              {mode === 'add' ? '一致するタグがありません' : '外せるタグがありません'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
