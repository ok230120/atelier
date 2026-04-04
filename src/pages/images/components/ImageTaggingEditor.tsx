import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RiAddLine, RiArrowRightLine, RiCloseLine, RiSearchLine } from 'react-icons/ri';
import type { ImageTagCategoryRecord, ImageTagRecord } from '../../../types/domain';
import { getImageFileUrl, normalizeImageTagName, type ImageTaggingMeta } from '../../../services/imageService';

type Props = {
  detail: ImageTaggingMeta | null;
  categories: ImageTagCategoryRecord[];
  allTags: ImageTagRecord[];
  recentTags: ImageTagRecord[];
  busy?: boolean;
  error?: string | null;
  onAddTag: (tagId: string) => Promise<void>;
  onRemoveTag: (tagId: string) => Promise<void>;
  onCreateTag: (name: string, categoryId: string) => Promise<void>;
  onNext: () => Promise<void>;
};

export default function ImageTaggingEditor({
  detail,
  categories,
  allTags,
  recentTags,
  busy = false,
  error,
  onAddTag,
  onRemoveTag,
  onCreateTag,
  onNext,
}: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | 'ALL'>('ALL');
  const [newTagCategoryId, setNewTagCategoryId] = useState(
    categories.find((category) => category.protected)?.id ?? categories[0]?.id ?? '',
  );

  useEffect(() => {
    if (!newTagCategoryId && categories.length > 0) {
      setNewTagCategoryId(categories.find((category) => category.protected)?.id ?? categories[0].id);
    }
  }, [categories, newTagCategoryId]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!detail) {
      setImageUrl(null);
      return () => undefined;
    }

    void getImageFileUrl(detail.image).then((url) => {
      if (!active) {
        if (url) {
          URL.revokeObjectURL(url);
        }
        return;
      }

      objectUrl = url;
      setImageUrl(url);
    });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [detail]);

  const currentTagIds = useMemo(() => detail?.image.tags ?? [], [detail?.image.tags]);
  const currentTagSet = useMemo(() => new Set(currentTagIds), [currentTagIds]);
  const normalizedQuery = normalizeImageTagName(query);
  const exactMatch = allTags.find((tag) => tag.normalizedName === normalizedQuery);
  const canCreate = normalizedQuery.length > 0 && !exactMatch && !!newTagCategoryId;
  const isSearching = normalizedQuery.length > 0;

  const filteredTags = useMemo(() => {
    return allTags.filter((tag) => {
      if (activeCategoryId !== 'ALL' && tag.categoryId !== activeCategoryId) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return tag.normalizedName.includes(normalizedQuery);
    });
  }, [activeCategoryId, allTags, normalizedQuery]);

  const activeCategoryLabel = useMemo(() => {
    if (isSearching) {
      return '検索結果';
    }
    if (activeCategoryId === 'ALL') {
      return 'すべてのタグ';
    }
    return categories.find((category) => category.id === activeCategoryId)?.name ?? 'タグ';
  }, [activeCategoryId, categories, isSearching]);

  const handleCreate = async () => {
    if (!canCreate || busy) {
      return;
    }
    await onCreateTag(query.trim(), newTagCategoryId);
    setQuery('');
  };

  if (!detail) {
    return (
      <section className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-border bg-bg-panel p-6 text-center">
        <p className="font-heading text-lg text-text-main">Tagging 準備中</p>
        <p className="mt-2 text-sm text-text-dim">
          次の対象画像がないため、ここでは作業できる画像がありません。
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-bg-panel">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate font-heading text-lg text-text-main">{detail.image.fileName}</h2>
            <p className="mt-1 text-xs text-text-dim">
              {detail.mount?.name ?? 'Unknown'} / {detail.image.folderPath || 'ルート'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/images/view/${detail.image.id}`}
              className="rounded-xl border border-border bg-bg-surface px-3 py-2 text-xs text-text-muted transition-colors hover:text-text-main"
            >
              詳細で開く
            </Link>
            <button
              type="button"
              onClick={() => void onNext()}
              disabled={busy}
              className="flex items-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              次へ
              <RiArrowRightLine size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-h-0 items-center justify-center bg-black/70 p-4">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={detail.image.fileName}
              className="max-h-full max-w-full rounded-xl object-contain"
            />
          ) : (
            <div className="text-sm text-white/50">画像を読み込めませんでした</div>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-y-auto border-l border-border px-5 py-4">
          <div>
            <p className="mb-2 text-xs text-text-dim">自動タグ</p>
            <div className="flex flex-wrap gap-2">
              {detail.autoTags.length > 0 ? (
                detail.autoTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-200"
                  >
                    {tag.name}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-dim">自動タグはありません</span>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-3 text-xs text-text-dim">手動タグ</p>
            {detail.manualTags.length === 0 ? (
              <p className="text-xs text-text-dim">まだ表示中の手動タグはありません</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {detail.manualTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => void onRemoveTag(tag.id)}
                    className="group flex items-center gap-1 rounded-full border border-border bg-bg-surface px-2.5 py-1 text-xs text-text-muted"
                  >
                    {tag.name}
                    <RiCloseLine
                      size={12}
                      className="opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {recentTags.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs text-text-dim">最近使ったタグ</p>
              <div className="flex flex-wrap gap-2">
                {recentTags.map((tag) => {
                  const disabled = currentTagSet.has(tag.id) || busy;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => void onAddTag(tag.id)}
                      className={
                        disabled
                          ? 'rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs text-accent'
                          : 'rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-muted transition-colors hover:text-text-main disabled:opacity-50'
                      }
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="mb-3 text-xs text-text-dim">タグ候補</p>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2">
              <RiSearchLine className="text-text-dim" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canCreate) {
                    void handleCreate();
                  }
                }}
                placeholder="タグを検索"
                className="flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-dim"
              />
            </div>

            {canCreate && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2">
                <RiAddLine className="text-accent" size={16} />
                <span className="flex-1 text-sm text-text-muted">
                  「<span className="text-accent">{query.trim()}</span>」を新規タグとして追加
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-text-dim">カテゴリ</p>
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setActiveCategoryId('ALL')}
                  className={
                    activeCategoryId === 'ALL'
                      ? 'min-h-[42px] rounded-xl border border-accent/50 bg-accent/15 px-3 py-2 text-center text-xs font-medium text-accent shadow-[inset_0_0_0_1px_rgba(96,165,250,0.18)]'
                      : 'min-h-[42px] rounded-xl border border-transparent bg-bg-panel px-3 py-2 text-center text-xs text-text-dim transition-colors hover:border-border hover:text-text-main'
                  }
                >
                  <span className="block truncate whitespace-nowrap">すべて</span>
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategoryId(category.id)}
                    className={
                      activeCategoryId === category.id
                        ? 'min-h-[42px] rounded-xl border border-accent/50 bg-accent/15 px-3 py-2 text-center text-xs font-medium text-accent shadow-[inset_0_0_0_1px_rgba(96,165,250,0.18)]'
                        : 'min-h-[42px] rounded-xl border border-transparent bg-bg-panel px-3 py-2 text-center text-xs text-text-dim transition-colors hover:border-border hover:text-text-main'
                    }
                  >
                    <span className="block truncate whitespace-nowrap">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-bg-panel px-4 py-3">
              <div className="mb-3 flex items-end justify-between gap-3">
                <p className="text-sm font-medium text-text-main">{activeCategoryLabel}</p>
                <p className="text-[11px] text-text-dim">{filteredTags.length}件</p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {filteredTags.map((tag) => {
                  const disabled = currentTagSet.has(tag.id) || busy;
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => void onAddTag(tag.id)}
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

          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        </div>
      </div>
    </section>
  );
}
