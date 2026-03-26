// FILE: src/pages/novels/components/SeriesManager.tsx
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiDraggable,
  RiArrowUpLine,
  RiArrowDownLine,
  RiEyeLine,
} from 'react-icons/ri';
import { Link } from 'react-router-dom';
import { db } from '../../../db/schema';
import type { Series } from '../../../types/domain';

const SeriesManager: React.FC = () => {
  const allSeries = useLiveQuery(() => db.series.orderBy('addedAt').reverse().toArray(), []) || [];
  const allNovels = useLiveQuery(() => db.novels.toArray(), []) || [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // 新規作成
  const handleCreate = async () => {
    if (!newName.trim()) {
      alert('シリーズ名を入力してください');
      return;
    }

    const series: Series = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDescription.trim() || undefined,
      novelIds: [],
      addedAt: Date.now(),
    };

    await db.series.add(series);
    setCreatingNew(false);
    setNewName('');
    setNewDescription('');
  };

  // 編集
  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      alert('シリーズ名を入力してください');
      return;
    }

    await db.series.update(id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
    });

    setEditingId(null);
    setEditName('');
    setEditDescription('');
  };

  // 削除
  const handleDelete = async (id: string) => {
    const series = allSeries.find((s) => s.id === id);
    if (!series) return;

    if (series.novelIds.length > 0) {
      if (!confirm(`このシリーズには ${series.novelIds.length} 個の小説が紐付いています。削除しますか？\n（小説自体は削除されません）`)) {
        return;
      }
      // 紐付いている小説の seriesId をクリア
      for (const novelId of series.novelIds) {
        await db.novels.update(novelId, { seriesId: undefined });
      }
    }

    await db.series.delete(id);
  };

  // シリーズ内の小説の順序変更
  const moveNovel = async (seriesId: string, novelId: string, direction: 'up' | 'down') => {
    const series = allSeries.find((s) => s.id === seriesId);
    if (!series) return;

    const index = series.novelIds.indexOf(novelId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= series.novelIds.length) return;

    const newNovelIds = [...series.novelIds];
    [newNovelIds[index], newNovelIds[newIndex]] = [newNovelIds[newIndex], newNovelIds[index]];

    await db.series.update(seriesId, { novelIds: newNovelIds });
  };

  // シリーズから小説を削除
  const removeNovelFromSeries = async (seriesId: string, novelId: string) => {
    const series = allSeries.find((s) => s.id === seriesId);
    if (!series) return;

    if (!confirm('このシリーズから小説を削除しますか？')) return;

    const newNovelIds = series.novelIds.filter((id) => id !== novelId);
    await db.series.update(seriesId, { novelIds: newNovelIds });
    await db.novels.update(novelId, { seriesId: undefined });
  };

  return (
    <div className="space-y-6">
      {/* 新規作成 */}
      <div className="bg-bg-panel border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold">Create New Series</h3>
        </div>

        {creatingNew ? (
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Series name..."
              className="w-full bg-bg-surface border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50"
              autoFocus
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)..."
              rows={2}
              className="w-full bg-bg-surface border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-accent border border-accent/50 rounded-xl text-white hover:bg-accent/90 transition-colors flex items-center gap-2"
              >
                <RiCheckLine />
                Create
              </button>
              <button
                onClick={() => {
                  setCreatingNew(false);
                  setNewName('');
                  setNewDescription('');
                }}
                className="px-4 py-2 bg-bg-surface border border-border rounded-xl text-text-main hover:border-border-light transition-colors flex items-center gap-2"
              >
                <RiCloseLine />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreatingNew(true)}
            className="w-full px-4 py-3 bg-accent/10 border-2 border-dashed border-accent/30 rounded-xl text-accent hover:bg-accent/20 transition-colors flex items-center justify-center gap-2"
          >
            <RiAddLine />
            <span className="font-medium">Create New Series</span>
          </button>
        )}
      </div>

      {/* シリーズ一覧 */}
      <div className="space-y-4">
        {allSeries.length === 0 ? (
          <div className="bg-bg-panel border border-border rounded-2xl p-12 text-center">
            <p className="text-text-dim">シリーズがまだありません</p>
          </div>
        ) : (
          allSeries.map((series) => {
            const novels = series.novelIds
              .map((id) => allNovels.find((n) => n.id === id))
              .filter((n) => n !== undefined);

            return (
              <div key={series.id} className="bg-bg-panel border border-border rounded-2xl p-6">
                {editingId === series.id ? (
                  <div className="space-y-3 mb-4">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-bg-surface border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50"
                      autoFocus
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)..."
                      rows={2}
                      className="w-full bg-bg-surface border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(series.id)}
                        className="px-3 py-1.5 bg-green-400/10 border border-green-400/30 rounded-lg text-green-400 hover:bg-green-400/20 transition-colors text-sm"
                      >
                        <RiCheckLine className="inline mr-1" />
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditName('');
                          setEditDescription('');
                        }}
                        className="px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-muted hover:text-text-main transition-colors text-sm"
                      >
                        <RiCloseLine className="inline mr-1" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-heading text-lg font-semibold text-text-main">{series.name}</h4>
                      {series.description && (
                        <p className="text-sm text-text-muted mt-1">{series.description}</p>
                      )}
                      <p className="text-xs text-text-dim mt-1">{novels.length} novels</p>
                    </div>
                    <div className="flex gap-1">
                      <Link
                        to={`/novels/series/${series.id}`}
                        className="p-2 text-text-muted hover:text-text-main hover:bg-bg-surface rounded-lg transition-colors"
                        title="View Series"
                      >
                        <RiEyeLine />
                      </Link>
                      <button
                        onClick={() => {
                          setEditingId(series.id);
                          setEditName(series.name);
                          setEditDescription(series.description || '');
                        }}
                        className="p-2 text-text-muted hover:text-text-main hover:bg-bg-surface rounded-lg transition-colors"
                        title="Edit"
                      >
                        <RiEditLine />
                      </button>
                      <button
                        onClick={() => handleDelete(series.id)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <RiDeleteBinLine />
                      </button>
                    </div>
                  </div>
                )}

                {/* シリーズ内の小説一覧 */}
                {novels.length > 0 && (
                  <div className="space-y-2">
                    {novels.map((novel, index) => (
                      <div
                        key={novel.id}
                        className="flex items-center gap-3 p-3 bg-bg-surface rounded-xl"
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveNovel(series.id, novel.id, 'up')}
                            disabled={index === 0}
                            className="p-1 text-text-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Up"
                          >
                            <RiArrowUpLine />
                          </button>
                          <button
                            onClick={() => moveNovel(series.id, novel.id, 'down')}
                            disabled={index === novels.length - 1}
                            className="p-1 text-text-muted hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Down"
                          >
                            <RiArrowDownLine />
                          </button>
                        </div>
                        <div className="flex-1">
                          <div className="font-body text-sm font-medium text-text-main">
                            {index + 1}. {novel.title}
                          </div>
                          <div className="text-xs text-text-dim">
                            {novel.wordCount.toLocaleString()} characters
                          </div>
                        </div>
                        <button
                          onClick={() => removeNovelFromSeries(series.id, novel.id)}
                          className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                          title="Remove from Series"
                        >
                          <RiCloseLine />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {novels.length === 0 && (
                  <div className="text-center py-6 text-text-dim text-sm">
                    このシリーズにはまだ小説が紐付いていません
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SeriesManager;