import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowDownLine,
  RiArrowLeftLine,
  RiArrowUpLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiEditLine,
  RiGitMergeLine,
  RiSearchLine,
} from 'react-icons/ri';
import type { ImageTagCategoryRecord, ImageTagRecord } from '../../types/domain';
import {
  backfillImageTagReadings,
  createImageTagCategory,
  deleteImageTag,
  deleteImageTagCategory,
  isAutoImageTag,
  listImageTagCategories,
  listImageTags,
  matchesImageTagSearch,
  mergeImageTags,
  moveImageTagToCategory,
  normalizeImageTagName,
  renameImageTag,
  renameImageTagCategory,
  reorderImageTagCategories,
} from '../../services/imageService';

function sortCategories(categories: ImageTagCategoryRecord[]) {
  return [...categories].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export default function ImageTagsPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ImageTagCategoryRecord[]>([]);
  const [tags, setTags] = useState<ImageTagRecord[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilterId, setCategoryFilterId] = useState<string>('all');
  const [showAutoTags, setShowAutoTags] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [mergingTagId, setMergingTagId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const [nextCategories, nextTags] = await Promise.all([listImageTagCategories(), listImageTags()]);
    setCategories(sortCategories(nextCategories));
    setTags(nextTags.sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name, 'ja')));
  };

  useEffect(() => {
    void refresh();
    void backfillImageTagReadings().then(() => refresh()).catch(() => undefined);
  }, []);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const filteredTags = useMemo(() => {
    const normalizedQuery = normalizeImageTagName(query);
    return tags.filter((tag) => {
      if (!showAutoTags && isAutoImageTag(tag)) return false;
      if (categoryFilterId !== 'all' && tag.categoryId !== categoryFilterId) return false;
      return matchesImageTagSearch(tag, query, normalizedQuery);
    });
  }, [categoryFilterId, query, showAutoTags, tags]);

  const manualTags = useMemo(() => tags.filter((tag) => !isAutoImageTag(tag)), [tags]);

  const runAction = async (action: () => Promise<void>, successMessage?: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refresh();
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    const ordered = sortCategories(categories);
    const index = ordered.findIndex((category) => category.id === categoryId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

    const next = [...ordered];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    await runAction(
      async () => {
        await reorderImageTagCategories(next.map((category) => category.id));
      },
      'カテゴリの並び順を更新しました。',
    );
  };

  const handleDeleteCategory = async (category: ImageTagCategoryRecord) => {
    if (
      !window.confirm(
        `カテゴリ「${category.name}」を削除しますか。所属するタグは「その他」へ移動します。`,
      )
    ) {
      return;
    }

    await runAction(
      async () => {
        await deleteImageTagCategory(category.id);
      },
      'カテゴリを削除しました。',
    );
  };

  const handleDeleteTag = async (tag: ImageTagRecord) => {
    const confirmMessage =
      tag.usageCount > 0
        ? `タグ「${tag.name}」を全画像から外して削除しますか。`
        : `タグ「${tag.name}」を削除しますか。`;
    if (!window.confirm(confirmMessage)) return;

    await runAction(
      async () => {
        await deleteImageTag(tag.id);
      },
      'タグを削除しました。',
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/images')}
          className="text-text-dim transition-colors hover:text-text-main"
          aria-label="Back to images"
        >
          <RiArrowLeftLine size={20} />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-text-dim">Images / Tags</p>
          <h1 className="font-heading text-2xl text-text-main">Tags</h1>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-border bg-bg-panel px-4 py-3 text-sm text-text-muted">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-bg-panel p-5">
          <div className="mb-4">
            <h2 className="font-heading text-lg text-text-main">カテゴリ</h2>
            <p className="mt-1 text-sm text-text-dim">
              追加、並び替え、名前変更、削除ができます。
            </p>
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="新しいカテゴリ名"
              className="flex-1 rounded-xl border border-border bg-bg-surface px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-dim"
            />
            <button
              type="button"
              disabled={!newCategoryName.trim() || busy}
              onClick={() =>
                void runAction(
                  async () => {
                    await createImageTagCategory(newCategoryName);
                    setNewCategoryName('');
                  },
                  'カテゴリを追加しました。',
                )
              }
              className="rounded-xl bg-accent px-4 py-2 text-sm text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              追加
            </button>
          </div>

          <div className="space-y-2">
            {categories.map((category, index) => (
              <div key={category.id} className="rounded-xl border border-border bg-bg-surface p-3">
                {editingCategoryId === category.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editingCategoryName}
                      onChange={(event) => setEditingCategoryName(event.target.value)}
                      className="flex-1 rounded-lg border border-border bg-bg-panel px-3 py-2 text-sm text-text-main outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          async () => {
                            await renameImageTagCategory(category.id, editingCategoryName);
                            setEditingCategoryId(null);
                            setEditingCategoryName('');
                          },
                          'カテゴリ名を更新しました。',
                        )
                      }
                      className="text-green-400 transition-colors hover:text-green-300"
                    >
                      <RiCheckLine size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(null);
                        setEditingCategoryName('');
                      }}
                      className="text-text-dim transition-colors hover:text-text-main"
                    >
                      <RiCloseLine size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCategoryFilterId(category.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm text-text-main">{category.name}</p>
                      {category.protected && (
                        <p className="mt-1 text-xs text-text-dim">保護カテゴリ</p>
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleMoveCategory(category.id, 'up')}
                        disabled={index === 0 || busy}
                        className="text-text-dim transition-colors hover:text-text-main disabled:opacity-30"
                      >
                        <RiArrowUpLine size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleMoveCategory(category.id, 'down')}
                        disabled={index === categories.length - 1 || busy}
                        className="text-text-dim transition-colors hover:text-text-main disabled:opacity-30"
                      >
                        <RiArrowDownLine size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditingCategoryName(category.name);
                        }}
                        disabled={busy}
                        className="text-text-dim transition-colors hover:text-text-main disabled:opacity-30"
                      >
                        <RiEditLine size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteCategory(category)}
                        disabled={category.protected || busy}
                        className="text-red-400 transition-colors hover:text-red-300 disabled:opacity-30"
                      >
                        <RiDeleteBinLine size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-panel p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-lg text-text-main">タグ</h2>
              <p className="mt-1 text-sm text-text-dim">
                タグ名の編集、カテゴリ移動、マージ、削除ができます。自動タグは再スキャンで再生成されるため、名前変更と削除はできません。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAutoTags((prev) => !prev)}
              className="rounded-xl border border-border bg-bg-surface px-3 py-2 text-xs text-text-muted transition-colors hover:text-text-main"
            >
              {showAutoTags ? '自動タグを隠す' : '自動タグを表示'}
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-3">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-bg-surface px-3 py-2">
              <RiSearchLine className="text-text-dim" size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="タグを検索"
                className="flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-dim"
              />
            </div>
            <select
              value={categoryFilterId}
              onChange={(event) => setCategoryFilterId(event.target.value)}
              className="rounded-xl border border-border bg-bg-surface px-3 py-2 text-sm text-text-main"
            >
              <option value="all">すべてのカテゴリ</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filteredTags.map((tag) => {
              const category = categoryMap.get(tag.categoryId);
              const mergeTargets = manualTags.filter((candidate) => candidate.id !== tag.id);
              const editing = editingTagId === tag.id;
              const merging = mergingTagId === tag.id;
              const auto = isAutoImageTag(tag);

              return (
                <div key={tag.id} className="rounded-xl border border-border bg-bg-surface p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editingTagName}
                            onChange={(event) => setEditingTagName(event.target.value)}
                            className="flex-1 rounded-lg border border-border bg-bg-panel px-3 py-2 text-sm text-text-main outline-none"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                async () => {
                                  await renameImageTag(tag.id, editingTagName);
                                  setEditingTagId(null);
                                  setEditingTagName('');
                                },
                                'タグ名を更新しました。',
                              )
                            }
                            className="text-green-400 transition-colors hover:text-green-300"
                          >
                            <RiCheckLine size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagId(null);
                              setEditingTagName('');
                            }}
                            className="text-text-dim transition-colors hover:text-text-main"
                          >
                            <RiCloseLine size={18} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm text-text-main">{tag.name}</p>
                          {auto && (
                            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                              自動
                            </span>
                          )}
                          <span className="text-xs text-text-dim">{tag.usageCount}件</span>
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-dim">
                        <span>カテゴリ: {category?.name ?? 'その他'}</span>
                        <select
                          value={tag.categoryId}
                          onChange={(event) =>
                            void runAction(
                              async () => {
                                await moveImageTagToCategory(tag.id, event.target.value);
                              },
                              'タグのカテゴリを更新しました。',
                            )
                          }
                          disabled={busy}
                          className="rounded-lg border border-border bg-bg-panel px-2 py-1 text-xs text-text-main disabled:opacity-50"
                        >
                          {categories.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {merging && !auto && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <select
                            value={mergeTargetId}
                            onChange={(event) => setMergeTargetId(event.target.value)}
                            className="min-w-[220px] rounded-lg border border-border bg-bg-panel px-3 py-2 text-sm text-text-main"
                          >
                            <option value="">マージ先を選択</option>
                            {mergeTargets.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!mergeTargetId || busy}
                            onClick={() =>
                              void runAction(
                                async () => {
                                  await mergeImageTags(tag.id, mergeTargetId);
                                  setMergingTagId(null);
                                  setMergeTargetId('');
                                },
                                'タグをマージしました。',
                              )
                            }
                            className="rounded-lg bg-accent px-3 py-2 text-xs text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                          >
                            マージ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMergingTagId(null);
                              setMergeTargetId('');
                            }}
                            className="text-text-dim transition-colors hover:text-text-main"
                          >
                            <RiCloseLine size={18} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingTagId(tag.id);
                          setEditingTagName(tag.name);
                        }}
                        disabled={auto || busy}
                        className="text-text-dim transition-colors hover:text-text-main disabled:opacity-30"
                      >
                        <RiEditLine size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMergingTagId(tag.id);
                          setMergeTargetId('');
                        }}
                        disabled={auto || busy || mergeTargets.length === 0}
                        className="text-text-dim transition-colors hover:text-text-main disabled:opacity-30"
                      >
                        <RiGitMergeLine size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTag(tag)}
                        disabled={auto || busy}
                        className="text-red-400 transition-colors hover:text-red-300 disabled:opacity-30"
                      >
                        <RiDeleteBinLine size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTags.length === 0 && (
              <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-text-dim">
                条件に合うタグはありません。
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
