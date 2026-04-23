import { useEffect, useMemo, useState } from 'react';
import { RiAddLine, RiCloseLine, RiSearchLine } from 'react-icons/ri';
import type { AppSettings, ImageTagCategoryRecord, ImageTagRecord } from '../../../types/domain';
import {
  backfillImageTagReadings,
  getImageAppSettings,
  getOrCreateImageTag,
  listImageTagCategories,
  listImageTags,
  matchesImageTagSearch,
  normalizeImageTagName,
  setImageAppSettings,
} from '../../../services/imageService';

type Props = {
  currentTagIds: string[];
  onSelect: (tag: ImageTagRecord) => void | Promise<void>;
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app',
  schemaVersion: 1,
  pinnedTags: [],
  tagSort: 'popular',
  filterMode: 'AND',
  thumbStore: 'idb',
};

function moveTagToRecent(tagId: string, tagIds: string[]) {
  return [tagId, ...tagIds.filter((current) => current !== tagId)].slice(0, 12);
}

export default function ImageDetailTagPanel({ currentTagIds, onSelect }: Props) {
  const [categories, setCategories] = useState<ImageTagCategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<ImageTagRecord[]>([]);
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'ALL'>('ALL');
  const [newTagCategoryId, setNewTagCategoryId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [nextCategories, nextTags, settings] = await Promise.all([
        listImageTagCategories(),
        listImageTags(),
        getImageAppSettings(),
      ]);
      if (cancelled) return;

      setCategories(nextCategories);
      setAllTags(nextTags);
      setRecentTagIds(settings?.imageImportRecentTagIds ?? []);
      setNewTagCategoryId(
        nextCategories.find((category) => category.protected)?.id ?? nextCategories[0]?.id ?? '',
      );
    };

    void load();
    void backfillImageTagReadings()
      .then(async () => {
        const nextTags = await listImageTags();
        if (!cancelled) setAllTags(nextTags);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!newTagCategoryId && categories.length > 0) {
      setNewTagCategoryId(categories.find((category) => category.protected)?.id ?? categories[0].id);
    }
  }, [categories, newTagCategoryId]);

  const currentTagSet = useMemo(() => new Set(currentTagIds), [currentTagIds]);
  const normalizedQuery = normalizeImageTagName(query);
  const exactMatch = allTags.find((tag) => tag.normalizedName === normalizedQuery);
  const canCreate = normalizedQuery.length > 0 && !exactMatch && !!newTagCategoryId;
  const isSearching = normalizedQuery.length > 0;

  const recentTags = useMemo(
    () =>
      recentTagIds
        .map((tagId) => allTags.find((tag) => tag.id === tagId) ?? null)
        .filter((tag): tag is ImageTagRecord => Boolean(tag)),
    [allTags, recentTagIds],
  );

  const filteredTags = useMemo(() => {
    return allTags.filter((tag) => {
      if (activeCategoryId !== 'ALL' && tag.categoryId !== activeCategoryId) return false;
      return matchesImageTagSearch(tag, query, normalizedQuery);
    });
  }, [activeCategoryId, allTags, normalizedQuery, query]);

  const activeCategoryLabel = useMemo(() => {
    if (isSearching) return '検索結果';
    if (activeCategoryId === 'ALL') return 'すべてのタグ';
    return categories.find((category) => category.id === activeCategoryId)?.name ?? 'タグ';
  }, [activeCategoryId, categories, isSearching]);

  const updateRecentTags = async (tagId: string) => {
    const settings = (await getImageAppSettings()) ?? DEFAULT_APP_SETTINGS;
    const nextRecentTagIds = moveTagToRecent(tagId, settings.imageImportRecentTagIds ?? []);
    await setImageAppSettings({
      ...settings,
      imageImportRecentTagIds: nextRecentTagIds,
    });
    setRecentTagIds(nextRecentTagIds);
  };

  const handleSelect = async (tag: ImageTagRecord) => {
    if (busy || currentTagSet.has(tag.id)) return;
    setBusy(true);
    try {
      await onSelect(tag);
      await updateRecentTags(tag.id);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!canCreate || busy) return;
    setBusy(true);
    try {
      const tag = await getOrCreateImageTag(query.trim(), newTagCategoryId);
      setAllTags(await listImageTags());
      await onSelect(tag);
      await updateRecentTags(tag.id);
      setQuery('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-bg-panel/90 p-4">
      {recentTags.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-text-dim">最近使ったタグ</p>
          <div className="flex flex-wrap gap-2">
            {recentTags.map((tag) => {
              const disabled = currentTagSet.has(tag.id) || busy;
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => void handleSelect(tag)}
                  className={
                    disabled
                      ? 'rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs text-accent'
                      : 'rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-main'
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={recentTags.length > 0 ? 'mt-4' : ''}>
        <p className="mb-3 text-xs text-text-dim">タグを追加</p>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2">
          <RiSearchLine className="text-text-dim" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canCreate) void handleCreate();
            }}
            placeholder="タグを検索"
            className="flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-dim"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="検索をクリア"
              className="rounded-md p-1 text-text-dim transition-colors hover:text-text-main"
            >
              <RiCloseLine size={14} />
            </button>
          )}
        </div>

        {canCreate && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
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
              type="button"
              onClick={() => void handleCreate()}
              disabled={busy}
              className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              追加
            </button>
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-border/60 bg-bg-surface/45 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-text-dim">Category</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCategoryId('ALL')}
              className={
                activeCategoryId === 'ALL'
                  ? 'rounded-xl border border-accent/50 bg-accent/15 px-3 py-2 text-xs font-medium text-white'
                  : 'rounded-xl border border-transparent bg-bg-panel px-3 py-2 text-xs text-white transition-colors hover:border-border'
              }
            >
              <span className="block max-w-[7rem] truncate whitespace-nowrap">すべて</span>
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategoryId(category.id)}
                className={
                  activeCategoryId === category.id
                    ? 'rounded-xl border border-accent/50 bg-accent/15 px-3 py-2 text-xs font-medium text-white'
                    : 'rounded-xl border border-transparent bg-bg-panel px-3 py-2 text-xs text-white transition-colors hover:border-border'
                }
              >
                <span className="block max-w-[7rem] truncate whitespace-nowrap">{category.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-bg-panel px-4 py-3">
          <div className="mb-3 flex items-end justify-between gap-3">
            <p className="text-sm font-medium text-text-main">{activeCategoryLabel}</p>
            <p className="text-[11px] text-text-dim">{filteredTags.length} 件</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filteredTags.map((tag) => {
              const disabled = currentTagSet.has(tag.id) || busy;
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => void handleSelect(tag)}
                  className={
                    disabled
                      ? 'cursor-default rounded-full border border-accent/40 bg-accent/20 px-3 py-1.5 text-xs text-accent'
                      : 'rounded-full border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-muted transition-all hover:border-accent/50 hover:text-text-main'
                  }
                >
                  {tag.name}
                  <span className="ml-1 opacity-60">{tag.usageCount}</span>
                </button>
              );
            })}
          </div>

          {filteredTags.length === 0 && !canCreate && (
            <p className="py-4 text-center text-sm text-text-dim">一致するタグがありません</p>
          )}
        </div>
      </div>
    </div>
  );
}
