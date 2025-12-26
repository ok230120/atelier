// FILE: src/pages/videos/VideosPage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiFilter3Line,
  RiLoader4Line,
  RiMovieLine,
  RiHardDriveLine,
} from 'react-icons/ri';

import { db } from '../../db/client';
import { useVideosQuery } from '../../hooks/useVideosQuery';
import { useAppSettings } from '../../hooks/useAppSettings';
import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';
import TagPinnedRow from '../../components/TagPinnedRow';
import ActiveFiltersBar from '../../components/ActiveFiltersBar';
import VideoCard from './components/VideoCard';
import TagDrawer from './components/TagDrawer';

function parsePage(v: string | null): number {
  const n = Number.parseInt(v ?? '1', 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 1;
  return Math.max(1, n);
}

function sortedTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

const VideosPage: React.FC = () => {
  const settings = useAppSettings();
  const mounts = useLiveQuery(() => db.mounts.toArray(), []) || [];

  const [searchParams, setSearchParams] = useSearchParams();
  const currentQS = searchParams.toString();

  // 「自分が直前に書いたQS」なら URL->State をスキップして殴り合いを止める
  const lastWrittenQSRef = useRef<string | null>(null);

  // 初期値はURLから
  const [searchText, setSearchText] = useState<string>(() => searchParams.get('q') ?? '');
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    sortedTags(searchParams.getAll('tag')),
  );
  const [selectedMountId, setSelectedMountId] = useState<string>(() => searchParams.get('m') ?? '');
  const [currentPage, setCurrentPage] = useState<number>(() => parsePage(searchParams.get('p')));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const pageSize = 20;

  const { videos, totalCount, isLoading } = useVideosQuery({
    searchText,
    tags: selectedTags,
    mountId: selectedMountId || undefined,
    page: currentPage,
    pageSize,
    sort: 'newest',
    filterMode: settings.filterMode,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const selectedMount = mounts.find((m) => m.id === selectedMountId);

  // restore/import後に dirHandle が消えるので、それを検知して警告を出す
  const mountsNeedRelink = useMemo(() => {
    return mounts.filter((m) => !(m as any).dirHandle);
  }, [mounts]);

  const desiredQS = useMemo(() => {
    const sp = new URLSearchParams();

    const q = searchText.trim();
    if (q) sp.set('q', q);

    for (const t of sortedTags(selectedTags)) sp.append('tag', t);

    if (selectedMountId) sp.set('m', selectedMountId);

    if (currentPage !== 1) sp.set('p', String(currentPage));

    return sp.toString();
  }, [searchText, selectedTags, selectedMountId, currentPage]);

  // URL -> State（戻る/進む・手入力用）
  useEffect(() => {
    if (lastWrittenQSRef.current === currentQS) {
      lastWrittenQSRef.current = null;
      return;
    }

    const q = searchParams.get('q') ?? '';
    const tags = sortedTags(searchParams.getAll('tag'));
    const m = searchParams.get('m') ?? '';
    const p = parsePage(searchParams.get('p'));

    if (q !== searchText) setSearchText(q);

    const tagsEqual =
      tags.length === selectedTags.length && tags.every((t, i) => t === selectedTags[i]);
    if (!tagsEqual) setSelectedTags(tags);

    if (m !== selectedMountId) setSelectedMountId(m);
    if (p !== currentPage) setCurrentPage(p);
  }, [currentQS]); // eslint-disable-line react-hooks/exhaustive-deps

  // State -> URL（ユーザー操作の反映）
  useEffect(() => {
    if (desiredQS === currentQS) return;

    lastWrittenQSRef.current = desiredQS;
    const sp = new URLSearchParams(desiredQS);
    setSearchParams(sp, { replace: true });
  }, [desiredQS, currentQS, setSearchParams]);

  const handleSearchChange = (val: string) => {
    setSearchText(val);
    setCurrentPage(1);
  };

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag];
      return sortedTags(next);
    });
    setCurrentPage(1);
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags((prev) => sortedTags(prev.filter((t) => t !== tagToRemove)));
    setCurrentPage(1);
  };

  const clearAllTags = () => {
    setSelectedTags([]);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    setSearchText('');
    setCurrentPage(1);
  };

  const clearMount = () => {
    setSelectedMountId('');
    setCurrentPage(1);
  };

  const resetAll = () => {
    setSearchText('');
    setSelectedTags([]);
    setSelectedMountId('');
    setCurrentPage(1);
  };

  const handleMountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMountId(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Library</h2>
          <p className="text-text-dim text-sm mt-1">{totalCount} videos found</p>
        </div>

        <div className="w-full md:w-auto flex flex-col items-end gap-3">
          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
            {/* Mount Filter */}
            <div className="relative w-full md:w-48">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <RiHardDriveLine className="text-text-dim" style={{ color: selectedMount?.color }} />
              </div>
              <select
                value={selectedMountId}
                onChange={handleMountChange}
                className="w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-10 pr-8 appearance-none focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all text-sm shadow-sm cursor-pointer"
              >
                <option value="">All Folders</option>
                {mounts.map((mount) => (
                  <option key={mount.id} value={mount.id}>
                    {mount.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-2 w-full md:w-80">
              <SearchBar value={searchText} onChange={handleSearchChange} placeholder="Search..." className="flex-1" />
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="px-3 py-2 bg-bg-panel border border-border rounded-xl text-text-muted hover:text-text-main hover:border-accent/50 transition-colors flex items-center gap-2"
                title="Open Tag Filter"
              >
                <RiFilter3Line />
                <span className="hidden sm:inline text-sm">Tags</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <TagPinnedRow pinnedTags={settings.pinnedTags} selectedTags={selectedTags} onToggleTag={handleToggleTag} />

      {/* ★ ここから追加（警告 + ActiveFiltersBar） */}
      {mountsNeedRelink.length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="font-medium">Some folders need re-linking</div>
              <div className="text-xs text-orange-200/80 mt-0.5">
                This happens after restore/import because folder handles cannot be exported.
              </div>
            </div>
            <Link
              to="/videos/manage"
              className="inline-flex items-center justify-center rounded-xl border border-orange-500/30 bg-bg-panel px-3 py-2 text-xs hover:border-orange-400/60 transition-colors"
            >
              Open Manage
            </Link>
          </div>
        </div>
      )}

      <ActiveFiltersBar
        searchText={searchText}
        selectedTags={selectedTags}
        mount={
          selectedMount
            ? { id: selectedMount.id, name: selectedMount.name, color: (selectedMount as any).color }
            : null
        }
        currentPage={currentPage}
        totalPages={totalPages}
        onClearSearch={clearSearch}
        onRemoveTag={removeTag}
        onClearTags={clearAllTags}
        onClearMount={clearMount}
        onResetAll={resetAll}
      />
      {/* ★ ここまで追加 */}

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-accent">
            <RiLoader4Line className="animate-spin text-4xl" />
          </div>
        ) : videos.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-dim border-2 border-dashed border-border/50 rounded-2xl">
            <RiMovieLine className="text-5xl opacity-20 mb-4" />
            <p className="text-lg font-medium">No videos found</p>
            {searchText || selectedTags.length > 0 || selectedMountId ? (
              <p className="text-sm mt-2 opacity-60">Try adjusting your search or filters.</p>
            ) : (
              <p className="text-sm mt-2 opacity-60">Add folders in the Manage page to get started.</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </div>

      <TagDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        videos={videos}
        activeTags={selectedTags}
        onToggleTag={handleToggleTag}
        tagSort={settings.tagSort}
      />
    </div>
  );
};

export default VideosPage;
