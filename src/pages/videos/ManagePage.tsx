// FILE: src/pages/videos/ManagePage.tsx
import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiArrowGoBackLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiEdit2Line,
  RiEraserLine,
  RiErrorWarningLine,
  RiFolderAddLine,
  RiFolderLine,
  RiHardDriveLine,
  RiHeart3Fill,
  RiHeart3Line,
  RiLoader4Line,
  RiMovieFill,
  RiPriceTag3Line,
  RiRefreshLine,
  RiSearchLine,
} from 'react-icons/ri';
import classNames from 'classnames';

import { db } from '../../db/client';
import type { FolderMount, Video } from '../../types/domain';
import { fileSystem } from '../../services/fileSystem';
import { scanMount, type ScanStats } from '../../services/scanner';
import DeleteVideoButton from './components/DeleteVideoButton';
import InlineTitleEditor from '../../components/InlineTitleEditor';
import { stripExt } from '../../utils/videoTitle';
import { clearVideoTitleOverride, setVideoTitleOverride } from '../../services/videoMeta';
import { queueAutoThumbnailGenerationForVideos } from '../../services/thumbnail';
import { useAutoThumbnailQueueStatus } from '../../hooks/useAutoThumbnailQueueStatus';
import { useVideoDerivedDataQueue } from '../../hooks/useVideoDerivedDataQueue';

const BATCH_SIZE = 50;

type StatusFilter =
  | 'all'
  | 'active'
  | 'missing'
  | 'needsThumb'
  | 'untitled'
  | 'favorite'
  | 'notFavorite';

const normalizeTag = (tag: string): string => {
  return tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/^#/, '');
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const ManagePage: React.FC = () => {
  const mounts = useLiveQuery(() => db.mounts.toArray(), []) || [];
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Record<string, ScanStats>>({});
  const [mountErrorMsg, setMountErrorMsg] = useState<string | null>(null);
  const [metadataNotice, setMetadataNotice] = useState<string | null>(null);

  const [editorMountId, setEditorMountId] = useState<string>('');
  const [editorVideos, setEditorVideos] = useState<Video[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');
  const [filterText, setFilterText] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<Video[] | null>(null);
  const [lastActionDescription, setLastActionDescription] = useState<string | null>(null);
  const queueStatus = useAutoThumbnailQueueStatus();
  const autoProgressValue = queueStatus.total > 0 ? ((queueStatus.completed + queueStatus.failed) / queueStatus.total) * 100 : 0;
  const showAutoProgress = !queueStatus.idle || queueStatus.total > 0;

  const displayedVideos = useMemo(() => {
    const text = normalizeText(filterText);
    const tag = normalizeTag(filterTag);

    return editorVideos.filter((video) => {
      const title = (video.titleOverride || stripExt(video.filename)).toLowerCase();
      const path = (video.relativePath || video.filename).toLowerCase();
      const tags = video.tags ?? [];

      if (text) {
        const textMatched =
          title.includes(text) ||
          path.includes(text) ||
          tags.some((item) => item.toLowerCase().includes(text));
        if (!textMatched) return false;
      }

      if (tag && !tags.includes(tag)) return false;

      switch (statusFilter) {
        case 'active':
          return !video.isMissing;
        case 'missing':
          return !!video.isMissing;
        case 'needsThumb':
          return !video.thumbnail;
        case 'untitled':
          return !video.titleOverride;
        case 'favorite':
          return video.favorite;
        case 'notFavorite':
          return !video.favorite;
        default:
          return true;
      }
    });
  }, [editorVideos, filterText, filterTag, statusFilter]);

  useVideoDerivedDataQueue(displayedVideos);

  const loadVideosForMount = async (mountId: string) => {
    setIsLoadingVideos(true);
    setEditorVideos([]);
    setSelectedIds(new Set());
    setUndoSnapshot(null);
    setMetadataNotice(null);

    try {
      const videos =
        mountId === 'all'
          ? await db.videos.toArray()
          : await db.videos.where('mountId').equals(mountId).toArray();

      videos.sort((a, b) => (a.relativePath || a.filename).localeCompare(b.relativePath || b.filename, 'ja'));
      setEditorVideos(videos);
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const startDerivedDataGeneration = async (mountId: string) => {
    const targetVideos =
      mountId === 'all'
        ? await db.videos.filter((video) => !video.isMissing).toArray()
        : await db.videos
            .where('mountId')
            .equals(mountId)
            .filter((video) => !video.isMissing)
            .toArray();

    const pending = targetVideos.filter((video) => !video.thumbnail || video.durationSec == null);
    queueAutoThumbnailGenerationForVideos(pending);

    if (pending.length > 0) {
      setMetadataNotice(`自動サムネイルと動画の長さの補完を ${pending.length} 件分キューに追加しました。`);
    }
  };

  const handleAddFolder = async () => {
    setMountErrorMsg(null);
    const dirHandle = await fileSystem.pickDirectory();
    if (!dirHandle) return;

    try {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `mount_${Date.now()}`;

      const newMount: FolderMount = {
        id,
        name: dirHandle.name,
        pathKind: 'handle',
        dirHandle: dirHandle as any,
        includeSubdirs: true,
        exts: ['mp4', 'mkv', 'webm', 'mov'],
        ignoreGlobs: [],
        addedAt: Date.now(),
      };

      await db.mounts.add(newMount);
    } catch (err) {
      console.error(err);
      setMountErrorMsg('フォルダの追加に失敗しました。');
    }
  };

  const handleDeleteMount = async (id: string) => {
    if (!window.confirm('このフォルダ登録を削除しますか？（動画データは DB に残ります）')) return;

    await db.mounts.delete(id);
    setScanResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (editorMountId === id) {
      setEditorMountId('');
      setEditorVideos([]);
      setSelectedIds(new Set());
    }
  };

  const handleScan = async (mount: FolderMount) => {
    if (!mount.dirHandle) {
      setMountErrorMsg('フォルダハンドルが見つかりません。');
      return;
    }

    setScanningId(mount.id);
    setMountErrorMsg(null);
    setMetadataNotice(null);

    try {
      const hasPerm = await fileSystem.verifyPermission(mount.dirHandle as any, 'read');
      if (!hasPerm) {
        setMountErrorMsg(`"${mount.name}" の読み取り権限がありません。`);
        return;
      }

      const stats = await scanMount(mount);
      setScanResults((prev) => ({ ...prev, [mount.id]: stats }));

      if (editorMountId === mount.id) {
        await loadVideosForMount(mount.id);
      }

      await startDerivedDataGeneration(mount.id);
    } catch (err: any) {
      console.error(err);
      setMountErrorMsg(`スキャンに失敗しました: ${err?.message || 'unknown error'}`);
    } finally {
      setScanningId(null);
    }
  };

  const handleMountSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setEditorMountId(newId);
    if (newId) {
      void loadVideosForMount(newId);
    } else {
      setEditorVideos([]);
      setSelectedIds(new Set());
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleIds = displayedVideos.map((video) => video.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      });
      return;
    }

    setSelectedIds((prev) => new Set([...prev, ...visibleIds]));
  };

  const executeBulkAction = async (actionName: string, transform: (video: Video) => Video | null) => {
    if (selectedIds.size === 0) return;

    const targets = editorVideos.filter((video) => selectedIds.has(video.id));
    if (targets.length === 0) return;

    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: targets.length });
    setUndoSnapshot(targets.map((video) => ({ ...video, tags: [...(video.tags || [])] })));
    setLastActionDescription(actionName);

    const updates: Video[] = [];
    for (const video of targets) {
      const clone: Video = { ...video, tags: [...(video.tags || [])] };
      const modified = transform(clone);
      if (modified) updates.push(modified);
    }

    try {
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        await db.videos.bulkPut(chunk);
        setBulkProgress({
          current: Math.min(i + BATCH_SIZE, updates.length),
          total: updates.length,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const updateMap = new Map(updates.map((video) => [video.id, video]));
      setEditorVideos((prev) => prev.map((video) => updateMap.get(video.id) || video));
    } catch (err) {
      console.error('Bulk action failed:', err);
      alert('一括更新中にエラーが発生しました。');
      if (editorMountId) {
        await loadVideosForMount(editorMountId);
      }
    } finally {
      setIsBulkProcessing(false);
      setBulkProgress(null);
    }
  };

  const handleUndo = async () => {
    if (!undoSnapshot || undoSnapshot.length === 0) return;

    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: undoSnapshot.length });

    try {
      for (let i = 0; i < undoSnapshot.length; i += BATCH_SIZE) {
        const chunk = undoSnapshot.slice(i, i + BATCH_SIZE);
        await db.videos.bulkPut(chunk);
        setBulkProgress({
          current: Math.min(i + BATCH_SIZE, undoSnapshot.length),
          total: undoSnapshot.length,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const restoredMap = new Map(undoSnapshot.map((video) => [video.id, video]));
      setEditorVideos((prev) => prev.map((video) => restoredMap.get(video.id) || video));
      setUndoSnapshot(null);
      setLastActionDescription(null);
      alert('直前の操作を取り消しました。');
    } catch (err) {
      console.error('Undo failed:', err);
      alert('取り消しに失敗しました。データを再読み込みしてください。');
    } finally {
      setIsBulkProcessing(false);
      setBulkProgress(null);
    }
  };

  const actionAddTag = () => {
    if (!tagInput.trim()) return;
    const tagToAdd = normalizeTag(tagInput);
    void executeBulkAction(`タグ追加: ${tagToAdd}`, (video) => {
      if (!video.tags.includes(tagToAdd)) {
        video.tags.push(tagToAdd);
        return video;
      }
      return null;
    });
    setTagInput('');
  };

  const actionRemoveTag = () => {
    if (!tagInput.trim()) return;
    const tagToRemove = normalizeTag(tagInput);
    void executeBulkAction(`タグ削除: ${tagToRemove}`, (video) => {
      if (video.tags.includes(tagToRemove)) {
        video.tags = video.tags.filter((tag) => tag !== tagToRemove);
        return video;
      }
      return null;
    });
    setTagInput('');
  };

  const actionSetFavorite = (isFavorite: boolean) => {
    void executeBulkAction(isFavorite ? 'お気に入りに設定' : 'お気に入り解除', (video) => {
      if (video.favorite !== isFavorite) {
        video.favorite = isFavorite;
        return video;
      }
      return null;
    });
  };

  const actionClearTitle = () => {
    void executeBulkAction('タイトル上書きをクリア', (video) => {
      if (video.titleOverride) {
        video.titleOverride = undefined;
        return video;
      }
      return null;
    });
  };

  const actionDeleteVideos = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    const ok = window.confirm(`選択中の ${count} 件の動画を削除しますか？（元ファイルは削除しません）`);
    if (!ok) return;

    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: count });

    try {
      const idsToDelete = Array.from(selectedIds);
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
        await db.videos.bulkDelete(chunk);
        setBulkProgress({
          current: Math.min(i + BATCH_SIZE, idsToDelete.length),
          total: idsToDelete.length,
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      if (editorMountId) {
        await loadVideosForMount(editorMountId);
      }
      setSelectedIds(new Set());
      alert(`${count} 件の動画を削除しました。`);
    } catch (err) {
      console.error('Bulk delete failed:', err);
      alert('削除中にエラーが発生しました。');
    } finally {
      setIsBulkProcessing(false);
      setBulkProgress(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-12">
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold">フォルダ管理</h2>
            <p className="text-text-dim text-sm mt-1">ローカルフォルダを接続して動画を取り込みます。</p>
          </div>
          <button
            type="button"
            onClick={handleAddFolder}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-accent/20"
          >
            <RiFolderAddLine className="text-lg" />
            フォルダを追加
          </button>
        </div>

        {mountErrorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
            <RiErrorWarningLine className="text-lg flex-shrink-0" />
            <span>{mountErrorMsg}</span>
          </div>
        )}

        {metadataNotice && (
          <div className="bg-accent/10 border border-accent/20 text-accent px-4 py-3 rounded-lg text-sm">
            {metadataNotice}
          </div>
        )}

        {showAutoProgress && (
          <div className="rounded-xl border border-border bg-bg-panel px-4 py-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-text-main">自動補完の進捗</div>
                <div className="text-xs text-text-dim mt-1">
                  サムネイル生成と動画情報の補完をバックグラウンドで処理しています。
                </div>
              </div>
              <div className="text-xs text-text-dim">
                {queueStatus.active ? '処理中' : '待機なし'}
              </div>
            </div>

            <div className="w-full bg-bg-surface h-2 rounded-full overflow-hidden">
              <div className="bg-accent h-full transition-all duration-300" style={{ width: `${autoProgressValue}%` }} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-text-dim sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-bg-surface px-3 py-2">
                処理中 {queueStatus.processing}件
              </div>
              <div className="rounded-lg border border-border bg-bg-surface px-3 py-2">
                待機 {queueStatus.queued}件
              </div>
              <div className="rounded-lg border border-border bg-bg-surface px-3 py-2">
                完了 {queueStatus.completed}件
              </div>
              <div className="rounded-lg border border-border bg-bg-surface px-3 py-2">
                失敗 {queueStatus.failed}件
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mounts.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-text-dim bg-bg-panel border border-border border-dashed rounded-xl">
              <RiHardDriveLine className="text-5xl opacity-20 mb-4" />
              <p className="font-medium">登録済みフォルダはありません</p>
              <p className="text-sm opacity-60 mt-1">「フォルダを追加」から始めてください。</p>
            </div>
          ) : (
            mounts.map((mount) => {
              const result = scanResults[mount.id];
              const isScanningThis = scanningId === mount.id;

              return (
                <div
                  key={mount.id}
                  className="bg-bg-panel border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:border-border/80 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-bg-surface border border-border flex items-center justify-center flex-shrink-0 text-accent">
                        <RiFolderLine className="text-xl" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-heading font-medium text-lg truncate" title={mount.name}>
                          {mount.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-text-dim font-mono">
                          <span>{new Date(mount.addedAt).toLocaleDateString()}</span>
                          {mount.includeSubdirs && (
                            <span className="flex items-center gap-1 bg-bg-surface px-1.5 py-0.5 rounded border border-border">
                              <RiCheckboxCircleLine /> 再帰
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteMount(mount.id)}
                      className="p-2 text-text-dim hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="フォルダ登録を削除"
                      disabled={isScanningThis}
                    >
                      <RiDeleteBinLine />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(mount.exts || []).map((ext) => (
                      <span
                        key={ext}
                        className="text-[10px] px-2 py-0.5 bg-bg-surface border border-border rounded text-text-muted font-mono uppercase"
                      >
                        {ext}
                      </span>
                    ))}
                    {(mount.ignoreGlobs || []).map((glob) => (
                      <span
                        key={glob}
                        className="text-[10px] px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-red-200 font-mono"
                      >
                        除外 {glob}
                      </span>
                    ))}
                  </div>

                  <div className="h-px bg-border w-full my-1" />

                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-xs">
                      {isScanningThis ? (
                        <span className="text-accent flex items-center gap-1.5">
                          <RiRefreshLine className="animate-spin" />
                          スキャン中...
                        </span>
                      ) : result ? (
                        <div className="flex flex-col gap-0.5 text-text-muted">
                          <span className="text-text-main font-medium">前回の結果</span>
                          <span>
                            追加 {result.added} / 更新 {result.updated} / missing {result.missing}
                          </span>
                          <span className="text-text-dim">
                            一致 {result.matchedVideoFiles} / 総ファイル {result.totalFiles}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-dim opacity-60">スキャン待ち</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleScan(mount)}
                      disabled={isScanningThis}
                      className={classNames(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-2',
                        isScanningThis
                          ? 'bg-bg-surface text-text-dim border-border cursor-not-allowed'
                          : 'bg-bg-surface text-text-main border-border hover:border-accent hover:text-accent',
                      )}
                    >
                      <RiRefreshLine className={classNames(isScanningThis && 'animate-spin')} />
                      スキャン
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="space-y-6 pt-6 border-t border-border">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <RiEdit2Line className="text-accent" />
            動画管理
          </h2>
          <p className="text-text-dim text-sm mt-1">検索・状態確認・一括編集をまとめて行えます。</p>
        </div>

        <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <label className="text-sm text-text-muted font-medium whitespace-nowrap">対象:</label>
              <select
                value={editorMountId}
                onChange={handleMountSelectChange}
                className="bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent min-w-[220px]"
              >
                <option value="" disabled>
                  フォルダを選択...
                </option>
                {mounts.length > 0 && <option value="all">すべてのフォルダ</option>}
                {mounts.map((mount) => (
                  <option key={mount.id} value={mount.id}>
                    {mount.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => editorMountId && void loadVideosForMount(editorMountId)}
                disabled={!editorMountId || isLoadingVideos}
                className="p-2 bg-bg-surface border border-border rounded-lg text-text-muted hover:text-text-main hover:border-accent/50 transition-colors"
                title="再読み込み"
              >
                <RiRefreshLine className={classNames(isLoadingVideos && 'animate-spin')} />
              </button>
              <button
                type="button"
                onClick={() => editorMountId && void startDerivedDataGeneration(editorMountId)}
                disabled={!editorMountId}
                className="px-3 py-2 rounded-lg border border-border text-xs text-text-main hover:border-accent/50 transition-colors"
              >
                自動サムネイル再キュー
              </button>
            </div>

            <div className="text-sm text-text-dim">
              表示 {displayedVideos.length} / 読み込み {editorVideos.length}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_200px_200px] gap-3">
            <div className="relative">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="タイトル・パス・タグを検索"
                className="w-full bg-bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div className="relative">
              <RiPriceTag3Line className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                type="text"
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                placeholder="タグで絞り込み"
                className="w-full bg-bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent"
            >
              <option value="all">状態: すべて</option>
              <option value="active">状態: 通常</option>
              <option value="missing">状態: missing</option>
              <option value="needsThumb">状態: サムネイル未設定</option>
              <option value="untitled">状態: タイトル未設定</option>
              <option value="favorite">状態: お気に入り</option>
              <option value="notFavorite">状態: お気に入り以外</option>
            </select>
          </div>

          <div className="h-px bg-border w-full" />

          <div
            className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between transition-opacity duration-200"
            style={{
              pointerEvents: selectedIds.size === 0 || isBulkProcessing ? 'none' : 'auto',
              opacity: selectedIds.size === 0 || isBulkProcessing ? 0.5 : 1,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex items-center">
                <RiPriceTag3Line className="absolute left-3 text-text-dim" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="一括タグ"
                  className="bg-bg-surface border border-border rounded-l-lg py-1.5 pl-9 pr-2 text-sm w-32 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex -ml-px">
                <button
                  type="button"
                  onClick={actionAddTag}
                  className="px-3 py-1.5 bg-bg-surface border border-border hover:bg-bg border-l-0 text-xs font-medium text-text-main hover:text-accent transition-colors"
                >
                  追加
                </button>
                <button
                  type="button"
                  onClick={actionRemoveTag}
                  className="px-3 py-1.5 bg-bg-surface border border-border hover:bg-bg border-l-0 rounded-r-lg text-xs font-medium text-text-main hover:text-red-400 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>

            <div className="w-px h-6 bg-border hidden lg:block" />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => actionSetFavorite(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs hover:text-red-500 hover:border-red-500/30 transition-colors"
              >
                <RiHeart3Fill /> お気に入り
              </button>
              <button
                type="button"
                onClick={() => actionSetFavorite(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs hover:text-text-dim transition-colors"
              >
                <RiHeart3Line /> 解除
              </button>
              <button
                type="button"
                onClick={actionClearTitle}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs hover:text-orange-400 transition-colors"
              >
                <RiEraserLine /> タイトル解除
              </button>
              <button
                type="button"
                onClick={() => void actionDeleteVideos()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500 transition-colors"
              >
                <RiDeleteBinLine /> 削除
              </button>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-text-dim hidden xl:inline">選択中: {selectedIds.size}</span>
              <button
                type="button"
                onClick={() => void handleUndo()}
                disabled={!undoSnapshot}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg hover:border-accent transition-colors"
                title={lastActionDescription ? `取り消し: ${lastActionDescription}` : '取り消し'}
              >
                <RiArrowGoBackLine /> 取り消し
              </button>
            </div>
          </div>
        </div>

        {isBulkProcessing && bulkProgress && (
          <div className="w-full bg-bg-panel h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full transition-all duration-200"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
        )}

        <div className="bg-bg-panel border border-border rounded-xl overflow-hidden shadow-sm min-h-[300px] flex flex-col relative">
          {isLoadingVideos ? (
            <div className="flex-1 flex items-center justify-center text-accent">
              <RiLoader4Line className="animate-spin text-3xl" />
            </div>
          ) : displayedVideos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
              {editorMountId ? '条件に一致する動画がありません。' : 'フォルダを選択すると動画を読み込みます。'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-bg-surface border-b border-border text-xs uppercase text-text-muted font-medium">
                  <tr>
                    <th className="px-4 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        className="rounded bg-bg border-border text-accent focus:ring-0"
                        checked={
                          displayedVideos.length > 0 &&
                          displayedVideos.every((video) => selectedIds.has(video.id))
                        }
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 w-28">サムネイル</th>
                    <th className="px-4 py-3">ファイル / パス</th>
                    <th className="px-4 py-3">タグ</th>
                    <th className="px-4 py-3 text-center w-20">状態</th>
                    <th className="px-4 py-3 text-center w-20">Fav</th>
                    <th className="px-4 py-3 text-center w-20">題名</th>
                    <th className="px-4 py-3 text-center w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {displayedVideos.map((video) => {
                    const isSelected = selectedIds.has(video.id);
                    return (
                      <tr
                        key={video.id}
                        className={classNames('hover:bg-bg-surface/50 transition-colors cursor-pointer', isSelected && 'bg-accent/5')}
                        onClick={() => toggleSelection(video.id)}
                      >
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded bg-bg border-border text-accent focus:ring-0"
                            checked={isSelected}
                            onChange={() => toggleSelection(video.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-24 aspect-video rounded-lg overflow-hidden border border-border bg-bg-surface flex items-center justify-center flex-shrink-0">
                            {video.thumbnail ? (
                              <img
                                src={video.thumbnail}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <RiMovieFill className="text-2xl text-text-dim opacity-30" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="min-w-[260px] max-w-lg whitespace-normal break-words space-y-1">
                            <InlineTitleEditor
                              compact
                              value={video.titleOverride}
                              fallback={stripExt(video.filename)}
                              onSave={(value) => setVideoTitleOverride(video.id, value)}
                              onClear={() => clearVideoTitleOverride(video.id)}
                            />
                            <div className="text-[11px] text-text-dim font-mono break-all">
                              {video.relativePath || video.filename}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 overflow-x-auto max-w-xs scrollbar-thin pb-1">
                            {video.tags.length > 0 ? (
                              video.tags.map((tag) => (
                                <span key={tag} className="px-1.5 py-0.5 rounded bg-bg border border-border text-[10px] text-text-muted">
                                  #{tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-text-dim text-[10px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {video.isMissing ? (
                            <span className="inline-flex items-center rounded-full border border-yellow-500/30 px-2 py-0.5 text-[10px] text-yellow-200">
                              missing
                            </span>
                          ) : video.thumbnail ? (
                            <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] text-text-dim">
                              {video.thumbnailSource === 'manual' ? '手動' : '自動'}
                            </span>
                          ) : (
                            <span className="text-text-dim text-[10px]">未生成</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {video.favorite ? <RiHeart3Fill className="inline text-red-500" /> : <span className="text-text-dim">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {video.titleOverride ? <RiCheckLine className="inline text-accent" /> : <span className="text-text-dim">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <DeleteVideoButton
                            videoId={video.id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border border-border hover:border-red-500/40 hover:text-red-400 transition-colors"
                            onDeleted={() => {
                              if (editorMountId) {
                                void loadVideosForMount(editorMountId);
                              }
                            }}
                            stopPropagation
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default ManagePage;
