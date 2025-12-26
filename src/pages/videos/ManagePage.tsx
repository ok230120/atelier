// FILE: src/pages/videos/ManagePage.tsx
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiFolderAddLine,
  RiFolderLine,
  RiHardDriveLine,
  RiRefreshLine,
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiEdit2Line,
  RiPriceTag3Line,
  RiHeart3Line,
  RiHeart3Fill,
  RiEraserLine,
  RiArrowGoBackLine,
  RiLoader4Line,
  RiCheckLine,
} from 'react-icons/ri';
import classNames from 'classnames';
import { db } from '../../db/client';
import type { FolderMount, Video } from '../../types/domain';
import { fileSystem } from '../../services/fileSystem';
import { scanMount, type ScanStats } from '../../services/scanner';

// --- Helper Functions ---
const normalizeTag = (tag: string): string => {
  return tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/^#/, '');
};

const BATCH_SIZE = 50;

const ManagePage: React.FC = () => {
  // --- Mount Management State ---
  const mounts = useLiveQuery(() => db.mounts.toArray(), []) || [];
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Record<string, ScanStats>>({});
  const [mountErrorMsg, setMountErrorMsg] = useState<string | null>(null);

  // --- Bulk Editor State ---
  const [editorMountId, setEditorMountId] = useState<string>('');
  const [editorVideos, setEditorVideos] = useState<Video[]>([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  // Undo: Stores the state of videos BEFORE the last batch operation
  const [undoSnapshot, setUndoSnapshot] = useState<Video[] | null>(null);
  const [lastActionDescription, setLastActionDescription] = useState<string | null>(null);

  // --- Mount Management Handlers ---
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
      setMountErrorMsg('Failed to add folder mount.');
    }
  };

  const handleDeleteMount = async (id: string) => {
    if (window.confirm('Remove this folder mount? (Indexed videos will remain in DB.)')) {
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
    }
  };

  const loadVideosForMount = async (mountId: string) => {
    setIsLoadingVideos(true);
    setEditorVideos([]);
    setSelectedIds(new Set());
    setUndoSnapshot(null); // Clear undo history on mount change

    try {
      let videos: Video[] = [];
      if (mountId === 'all') {
        videos = await db.videos.toArray();
      } else {
        videos = await db.videos.where('mountId').equals(mountId).toArray();
      }

      // Sort by path/filename
      videos.sort((a, b) => (a.relativePath || a.filename).localeCompare(b.relativePath || b.filename));

      setEditorVideos(videos);
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const handleScan = async (mount: FolderMount) => {
    if (!mount.dirHandle) {
      setMountErrorMsg('Directory handle is missing.');
      return;
    }

    setScanningId(mount.id);
    setMountErrorMsg(null);

    try {
      const hasPerm = await fileSystem.verifyPermission(mount.dirHandle as any, 'read');
      if (!hasPerm) {
        setMountErrorMsg(`Permission denied for "${mount.name}". Please allow access in the dialog.`);
        return;
      }

      const stats = await scanMount(mount);
      setScanResults((prev) => ({ ...prev, [mount.id]: stats }));

      // If we are currently editing this mount, refresh the list
      if (editorMountId === mount.id) {
        loadVideosForMount(mount.id);
      }
    } catch (err: any) {
      console.error(err);
      setMountErrorMsg(`Scan failed: ${err?.message || 'unknown error'}`);
    } finally {
      setScanningId(null);
    }
  };

  // --- Bulk Editor Handlers ---
  const handleMountSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setEditorMountId(newId);
    if (newId) loadVideosForMount(newId);
    else setEditorVideos([]);
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
    if (selectedIds.size === editorVideos.length && editorVideos.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(editorVideos.map((v) => v.id)));
    }
  };

  const executeBulkAction = async (actionName: string, transform: (video: Video) => Video | null) => {
    if (selectedIds.size === 0) return;

    const targets = editorVideos.filter((v) => selectedIds.has(v.id));
    if (targets.length === 0) return;

    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: targets.length });

    // 1. Create Snapshot for Undo
    setUndoSnapshot(targets.map((v) => ({ ...v })));
    setLastActionDescription(actionName);

    // 2. Prepare updates
    const updates: Video[] = [];
    for (const video of targets) {
      const clone: Video = { ...video, tags: [...(video.tags || [])] };
      const modified = transform(clone);
      if (modified) updates.push(modified);
    }

    // 3. Process in batches
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

      // 4. Update local state
      const updateMap = new Map(updates.map((v) => [v.id, v]));
      setEditorVideos((prev) => prev.map((v) => updateMap.get(v.id) || v));
    } catch (err) {
      console.error('Bulk action failed:', err);
      alert('An error occurred during bulk update.');
      if (editorMountId) loadVideosForMount(editorMountId);
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

      // Restore local state
      const restoredMap = new Map(undoSnapshot.map((v) => [v.id, v]));
      setEditorVideos((prev) => prev.map((v) => restoredMap.get(v.id) || v));

      setUndoSnapshot(null);
      setLastActionDescription(null);
      alert('Undo successful.');
    } catch (err) {
      console.error('Undo failed:', err);
      alert('Undo failed. Please refresh the data.');
    } finally {
      setIsBulkProcessing(false);
      setBulkProgress(null);
    }
  };

  // Actions
  const actionAddTag = () => {
    if (!tagInput.trim()) return;
    const tagToAdd = normalizeTag(tagInput);
    executeBulkAction(`Add tag "${tagToAdd}"`, (video) => {
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
    executeBulkAction(`Remove tag "${tagToRemove}"`, (video) => {
      if (video.tags.includes(tagToRemove)) {
        video.tags = video.tags.filter((t) => t !== tagToRemove);
        return video;
      }
      return null;
    });
    setTagInput('');
  };

  const actionSetFavorite = (isFavorite: boolean) => {
    executeBulkAction(isFavorite ? 'Set Favorite' : 'Unset Favorite', (video) => {
      if (video.favorite !== isFavorite) {
        video.favorite = isFavorite;
        return video;
      }
      return null;
    });
  };

  const actionClearTitle = () => {
    executeBulkAction('Clear Title Override', (video) => {
      if (video.titleOverride) {
        video.titleOverride = undefined;
        return video;
      }
      return null;
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 space-y-12">
      {/* --- Section 1: Manage Folders --- */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-6">
          <div>
            <h2 className="font-heading text-2xl font-bold">Manage Folders</h2>
            <p className="text-text-dim text-sm mt-1">Connect local directories to import videos.</p>
          </div>
          <button
            onClick={handleAddFolder}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-accent/20"
          >
            <RiFolderAddLine className="text-lg" />
            Add Folder
          </button>
        </div>

        {mountErrorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
            <RiErrorWarningLine className="text-lg flex-shrink-0" />
            <span>{mountErrorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mounts.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center text-text-dim bg-bg-panel border border-border border-dashed rounded-xl">
              <RiHardDriveLine className="text-5xl opacity-20 mb-4" />
              <p className="font-medium">No folders registered</p>
              <p className="text-sm opacity-60 mt-1">Click "Add Folder" to get started.</p>
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
                              <RiCheckboxCircleLine /> recursive
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMount(mount.id)}
                      className="p-2 text-text-dim hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Remove folder"
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
                  </div>

                  <div className="h-px bg-border w-full my-1" />

                  <div className="flex items-center justify-between mt-auto">
                    <div className="text-xs">
                      {isScanningThis ? (
                        <span className="text-accent flex items-center gap-1.5">
                          <RiRefreshLine className="animate-spin" />
                          Scanning...
                        </span>
                      ) : result ? (
                        <div className="flex flex-col gap-0.5 text-text-muted">
                          <span className="text-text-main font-medium">Last Scan:</span>
                          <span>
                            Added: {result.added}, Updated: {result.updated}
                          </span>
                          <span className="text-text-dim">
                            Matched: {result.matchedVideoFiles} / Total: {result.totalFiles}
                          </span>
                        </div>
                      ) : (
                        <span className="text-text-dim opacity-60">Ready to scan</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleScan(mount)}
                      disabled={isScanningThis}
                      className={classNames(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all flex items-center gap-2',
                        isScanningThis
                          ? 'bg-bg-surface text-text-dim border-border cursor-not-allowed'
                          : 'bg-bg-surface text-text-main border-border hover:border-accent hover:text-accent',
                      )}
                    >
                      <RiRefreshLine className={classNames(isScanningThis && 'animate-spin')} />
                      Scan
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* --- Section 2: Bulk Video Editor --- */}
      <section className="space-y-6 pt-6 border-t border-border">
        <div>
          <h2 className="font-heading text-2xl font-bold flex items-center gap-2">
            <RiEdit2Line className="text-accent" />
            Bulk Video Editor
          </h2>
          <p className="text-text-dim text-sm mt-1">Batch edit tags, titles, and favorites.</p>
        </div>

        {/* Toolbar */}
        <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col gap-4">
          {/* Top Row: Mount Selection */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <label className="text-sm text-text-muted font-medium whitespace-nowrap">Target:</label>
              <select
                value={editorMountId}
                onChange={handleMountSelectChange}
                className="bg-bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-main focus:outline-none focus:border-accent min-w-[200px]"
              >
                <option value="" disabled>
                  Select a folder...
                </option>
                {mounts.length > 0 && <option value="all">All Mounts</option>}
                {mounts.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => editorMountId && loadVideosForMount(editorMountId)}
                disabled={!editorMountId || isLoadingVideos}
                className="p-2 bg-bg-surface border border-border rounded-lg text-text-muted hover:text-text-main hover:border-accent/50 transition-colors"
                title="Refresh List"
              >
                <RiRefreshLine className={classNames(isLoadingVideos && 'animate-spin')} />
              </button>
            </div>

            <div className="text-sm text-text-dim">{editorVideos.length} videos loaded</div>
          </div>

          <div className="h-px bg-border w-full" />

          {/* Action Row */}
          <div
            className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between transition-opacity duration-200"
            style={{
              pointerEvents: selectedIds.size === 0 || isBulkProcessing ? 'none' : 'auto',
              opacity: selectedIds.size === 0 || isBulkProcessing ? 0.5 : 1,
            }}
          >
            {/* Tag Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex items-center">
                <RiPriceTag3Line className="absolute left-3 text-text-dim" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="tag-name"
                  className="bg-bg-surface border border-border rounded-l-lg py-1.5 pl-9 pr-2 text-sm w-32 focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex -ml-px">
                <button
                  onClick={actionAddTag}
                  className="px-3 py-1.5 bg-bg-surface border border-border hover:bg-bg border-l-0 text-xs font-medium text-text-main hover:text-accent transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={actionRemoveTag}
                  className="px-3 py-1.5 bg-bg-surface border border-border hover:bg-bg border-l-0 rounded-r-lg text-xs font-medium text-text-main hover:text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="w-px h-6 bg-border hidden lg:block" />

            {/* Meta Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => actionSetFavorite(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs hover:text-red-500 hover:border-red-500/30 transition-colors"
              >
                <RiHeart3Fill /> Set Fav
              </button>
              <button
                onClick={() => actionSetFavorite(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs hover:text-text-dim transition-colors"
              >
                <RiHeart3Line /> Unset
              </button>
              <button
                onClick={actionClearTitle}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs hover:text-orange-400 transition-colors"
              >
                <RiEraserLine /> Clear Titles
              </button>
            </div>

            {/* Undo */}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-text-dim hidden xl:inline">Selected: {selectedIds.size}</span>
              <button
                onClick={handleUndo}
                disabled={!undoSnapshot}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-xs text-text-main disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg hover:border-accent transition-colors"
                title={lastActionDescription ? `Undo: ${lastActionDescription}` : 'Undo'}
              >
                <RiArrowGoBackLine /> Undo
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {isBulkProcessing && bulkProgress && (
          <div className="w-full bg-bg-panel h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full transition-all duration-200"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
        )}

        {/* Data Table */}
        <div className="bg-bg-panel border border-border rounded-xl overflow-hidden shadow-sm min-h-[300px] flex flex-col relative">
          {isLoadingVideos ? (
            <div className="flex-1 flex items-center justify-center text-accent">
              <RiLoader4Line className="animate-spin text-3xl" />
            </div>
          ) : editorVideos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-dim text-sm">
              {editorMountId ? 'No videos found in this folder.' : 'Select a folder to load videos.'}
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
                        checked={editorVideos.length > 0 && selectedIds.size === editorVideos.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3">File / Path</th>
                    <th className="px-4 py-3">Tags</th>
                    <th className="px-4 py-3 text-center w-20">Fav</th>
                    <th className="px-4 py-3 text-center w-20">Title Set</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {editorVideos.map((video) => {
                    const isSelected = selectedIds.has(video.id);
                    return (
                      <tr
                        key={video.id}
                        className={classNames('hover:bg-bg-surface/50 transition-colors', isSelected && 'bg-accent/5')}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            className="rounded bg-bg border-border text-accent focus:ring-0"
                            checked={isSelected}
                            onChange={() => toggleSelection(video.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-text-main truncate max-w-xs xl:max-w-md" title={video.filename}>
                              {video.filename}
                            </span>
                            <span className="text-xs text-text-dim truncate max-w-xs xl:max-w-md" title={video.relativePath}>
                              {video.relativePath}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 overflow-x-auto max-w-xs scrollbar-thin pb-1">
                            {video.tags.length > 0 ? (
                              video.tags.map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded bg-bg border border-border text-[10px] text-text-muted">
                                  #{t}
                                </span>
                              ))
                            ) : (
                              <span className="text-text-dim text-[10px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {video.favorite ? <RiHeart3Fill className="inline text-red-500" /> : <span className="text-text-dim">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {video.titleOverride ? <RiCheckLine className="inline text-accent" /> : <span className="text-text-dim">-</span>}
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
