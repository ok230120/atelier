// FILE: src/pages/novels/components/TagManager.tsx
import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiEditLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiPushpinLine,
  RiPushpin2Fill,
  RiArrowUpDownLine,
  RiRefreshLine,
} from 'react-icons/ri';
import { db } from '../../../db/schema';
import { renameTag, deleteTag, mergeTags, setPinnedTags } from '../../../services/tagService';
import TagChip from '../../../components/TagChip';

const TagManager: React.FC = () => {
  const allTags = useLiveQuery(() => db.tags.where('category').equals('novel').toArray(), []) || [];
  const settings = useLiveQuery(() => db.settings.get('app'), []);

  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [mergingTag, setMergingTag] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const [pinnedTags, setPinnedTagsState] = useState<string[]>([]);
  const [recalculating, setRecalculating] = useState(false);

  // 固定タグの読み込み
  React.useEffect(() => {
    if (settings?.pinnedNovelTags) {
      setPinnedTagsState(settings.pinnedNovelTags);
    }
  }, [settings]);

  // タグのソート（使用数順）
  const sortedTags = useMemo(() => {
    return [...allTags].sort((a, b) => b.count - a.count);
  }, [allTags]);

  // タグカウントの再計算
  const recalculateTagCounts = async () => {
    if (!confirm('全てのタグのカウントを再計算しますか？\nこの操作により、正確なカウントに修正されます。')) {
      return;
    }

    setRecalculating(true);
    try {
      // 全ての小説を取得
      const novels = await db.novels.toArray();
      
      // タグごとの使用回数をカウント
      const tagCountMap = new Map<string, number>();
      for (const novel of novels) {
        for (const tag of novel.tags) {
          tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
        }
      }

      // 既存のタグを全て取得
      const existingTags = await db.tags.where('category').equals('novel').toArray();

      // カウントを更新
      for (const tag of existingTags) {
        const correctCount = tagCountMap.get(tag.name) || 0;
        await db.tags.update(tag.id, { count: correctCount });
      }

      // 小説には存在するが、tagsテーブルにないタグを追加
      for (const [tagName, count] of tagCountMap.entries()) {
        const tagId = `novel:${tagName}`;
        const existing = await db.tags.get(tagId);
        if (!existing) {
          await db.tags.add({
            id: tagId,
            category: 'novel',
            name: tagName,
            count,
          });
        }
      }

      alert('タグカウントの再計算が完了しました！');
    } catch (error) {
      console.error('Failed to recalculate tag counts:', error);
      alert('タグカウントの再計算に失敗しました');
    } finally {
      setRecalculating(false);
    }
  };

  // リネーム処理
  const handleRename = async (oldName: string) => {
    if (!newName.trim()) return;
    try {
      await renameTag('novel', oldName, newName.trim());
      setEditingTag(null);
      setNewName('');
    } catch (error) {
      console.error('Failed to rename tag:', error);
      alert('タグのリネームに失敗しました');
    }
  };

  // 削除処理
  const handleDelete = async (tagName: string) => {
    const tag = allTags.find((t) => t.name === tagName);
    if (!tag) return;

    if (tag.count > 0) {
      alert('使用中のタグは削除できません');
      return;
    }

    if (!confirm(`タグ「${tagName}」を削除しますか？`)) return;

    try {
      await deleteTag('novel', tagName);
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert('タグの削除に失敗しました');
    }
  };

  // 統合処理
  const handleMerge = async (sourceTag: string) => {
    if (!mergeTarget.trim()) return;

    if (!confirm(`タグ「${sourceTag}」を「${mergeTarget}」に統合しますか？`)) return;

    try {
      await mergeTags('novel', sourceTag, mergeTarget.trim());
      setMergingTag(null);
      setMergeTarget('');
    } catch (error) {
      console.error('Failed to merge tags:', error);
      alert('タグの統合に失敗しました');
    }
  };

  // 固定タグの切り替え
  const togglePinned = async (tagName: string) => {
    const newPinned = pinnedTags.includes(tagName)
      ? pinnedTags.filter((t) => t !== tagName)
      : [...pinnedTags, tagName];

    setPinnedTagsState(newPinned);
    await setPinnedTags('novel', newPinned);
  };

  // 固定タグの並び替え
  const movePinnedTag = async (tagName: string, direction: 'up' | 'down') => {
    const index = pinnedTags.indexOf(tagName);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pinnedTags.length) return;

    const newPinned = [...pinnedTags];
    [newPinned[index], newPinned[newIndex]] = [newPinned[newIndex], newPinned[index]];

    setPinnedTagsState(newPinned);
    await setPinnedTags('novel', newPinned);
  };

  return (
    <div className="space-y-6">
      {/* 再計算ボタン */}
      <div className="bg-bg-panel border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-sm font-semibold text-text-main">Tag Count Maintenance</h3>
            <p className="text-xs text-text-dim mt-1">
              タグのカウントに不整合がある場合、再計算して正確な値に修正できます
            </p>
          </div>
          <button
            onClick={recalculateTagCounts}
            disabled={recalculating}
            className="px-4 py-2 bg-accent/10 border border-accent/30 rounded-xl text-accent hover:bg-accent/20 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RiRefreshLine className={recalculating ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">
              {recalculating ? 'Recalculating...' : 'Recalculate Counts'}
            </span>
          </button>
        </div>
      </div>

      {/* 固定タグセクション */}
      <div className="bg-bg-panel border border-border rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <RiPushpin2Fill className="text-accent text-xl" />
          <h3 className="font-heading text-lg font-semibold">Pinned Tags</h3>
        </div>
        {pinnedTags.length === 0 ? (
          <p className="text-text-dim text-sm">ピン留めされたタグはありません</p>
        ) : (
          <div className="space-y-2">
            {pinnedTags.map((tagName) => {
              const tag = allTags.find((t) => t.name === tagName);
              if (!tag) return null;

              return (
                <div
                  key={tagName}
                  className="flex items-center justify-between p-3 bg-bg-surface rounded-xl"
                >
                  <TagChip label={`${tag.name} (${tag.count})`} isSelected />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => movePinnedTag(tagName, 'up')}
                      disabled={pinnedTags.indexOf(tagName) === 0}
                      className="p-2 text-text-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <RiArrowUpDownLine className="rotate-180" />
                    </button>
                    <button
                      onClick={() => movePinnedTag(tagName, 'down')}
                      disabled={pinnedTags.indexOf(tagName) === pinnedTags.length - 1}
                      className="p-2 text-text-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <RiArrowUpDownLine />
                    </button>
                    <button
                      onClick={() => togglePinned(tagName)}
                      className="p-2 text-accent hover:text-accent/80"
                      title="Unpin"
                    >
                      <RiPushpin2Fill />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 全タグ一覧 */}
      <div className="bg-bg-panel border border-border rounded-2xl p-6">
        <h3 className="font-heading text-lg font-semibold mb-4">All Tags</h3>
        {sortedTags.length === 0 ? (
          <p className="text-text-dim text-sm">タグがありません</p>
        ) : (
          <div className="space-y-3">
            {sortedTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-4 bg-bg-surface rounded-xl hover:bg-bg-surface/80 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {editingTag === tag.name ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="New tag name..."
                        className="flex-1 bg-bg-panel border border-border text-text-main rounded-xl px-3 py-2 focus:outline-none focus:border-accent/50 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(tag.name)}
                        className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg"
                        title="Save"
                      >
                        <RiCheckLine />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTag(null);
                          setNewName('');
                        }}
                        className="p-2 text-text-muted hover:bg-bg-panel rounded-lg"
                        title="Cancel"
                      >
                        <RiCloseLine />
                      </button>
                    </div>
                  ) : mergingTag === tag.name ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={mergeTarget}
                        onChange={(e) => setMergeTarget(e.target.value)}
                        placeholder="Merge into tag name..."
                        className="flex-1 bg-bg-panel border border-border text-text-main rounded-xl px-3 py-2 focus:outline-none focus:border-accent/50 text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleMerge(tag.name)}
                        className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg"
                        title="Merge"
                      >
                        <RiCheckLine />
                      </button>
                      <button
                        onClick={() => {
                          setMergingTag(null);
                          setMergeTarget('');
                        }}
                        className="p-2 text-text-muted hover:bg-bg-panel rounded-lg"
                        title="Cancel"
                      >
                        <RiCloseLine />
                      </button>
                    </div>
                  ) : (
                    <>
                      <TagChip label={tag.name} isSelected={pinnedTags.includes(tag.name)} />
                      <span className="text-sm text-text-dim">({tag.count} novels)</span>
                    </>
                  )}
                </div>

                {!editingTag && !mergingTag && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => togglePinned(tag.name)}
                      className={`p-2 rounded-lg transition-colors ${
                        pinnedTags.includes(tag.name)
                          ? 'text-accent hover:text-accent/80'
                          : 'text-text-muted hover:text-text-main'
                      }`}
                      title={pinnedTags.includes(tag.name) ? 'Unpin' : 'Pin'}
                    >
                      {pinnedTags.includes(tag.name) ? <RiPushpin2Fill /> : <RiPushpinLine />}
                    </button>
                    <button
                      onClick={() => {
                        setEditingTag(tag.name);
                        setNewName(tag.name);
                      }}
                      className="p-2 text-text-muted hover:text-text-main hover:bg-bg-panel rounded-lg"
                      title="Rename"
                    >
                      <RiEditLine />
                    </button>
                    <button
                      onClick={() => setMergingTag(tag.name)}
                      className="p-2 text-text-muted hover:text-text-main hover:bg-bg-panel rounded-lg"
                      title="Merge"
                    >
                      <RiArrowUpDownLine className="rotate-90" />
                    </button>
                    <button
                      onClick={() => handleDelete(tag.name)}
                      disabled={tag.count > 0}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                      title={tag.count > 0 ? 'Cannot delete tag in use' : 'Delete'}
                    >
                      <RiDeleteBinLine />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagManager;
