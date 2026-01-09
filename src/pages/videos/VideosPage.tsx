// FILE: src/pages/videos/VideosPage.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiFilter3Line,
  RiLoader4Line,
  RiMovieLine,
  RiHardDriveLine,
  RiSortDesc,
  RiTimeLine,
  RiLayoutGridLine,
} from 'react-icons/ri';

import { db } from '../../db/client';
import { useVideosQuery } from '../../hooks/useVideosQuery';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useVideoListUrlState, type SortOption, type LenOption } from '../../hooks/useVideoListUrlState';
import { useTagRankingQuery } from '../../hooks/useTagRankingQuery';

import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';
import TagPinnedRow from '../../components/TagPinnedRow';
import ActiveFiltersBar from '../../components/ActiveFiltersBar';
import VideoCard from './components/VideoCard';
import TagDrawer from './components/TagDrawer';

const VideosPage: React.FC = () => {
  const settings = useAppSettings();
  const mounts = useLiveQuery(() => db.mounts.toArray(), []) || [];

  const list = useVideoListUrlState();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { videos, totalCount, isLoading } = useVideosQuery({
    searchText: list.searchText,
    tags: list.selectedTags,
    mountId: list.selectedMountId || undefined,
    page: list.currentPage,
    pageSize: list.pageSize,
    sort: list.sortOrder,
    filterMode: settings.filterMode,
    minDuration: list.minDurationSec,
    maxDuration: list.maxDurationSec,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / list.pageSize) || 1);
  const selectedMount = mounts.find((m) => m.id === list.selectedMountId);

  const mountsNeedRelink = useMemo(() => {
    return mounts.filter((m) => m.pathKind === 'handle' && !m.dirHandle);
  }, [mounts]);

  // Tag ranking should be computed from the full filtered dataset (NOT the current page)
  const { ranking: tagRanking, isLoading: tagRankingLoading } = useTagRankingQuery({
    favoritesOnly: false,
    tagSort: settings.tagSort,
  });

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Library</h2>
          <p className="text-text-dim text-sm mt-1">{totalCount} videos found</p>
        </div>

        <div className="flex flex-col gap-3 w-full xl:w-auto">
          <div className="flex flex-col md:flex-row gap-2 w-full">
            {/* Mount Filter */}
            <div className="relative w-full md:w-40 flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <RiHardDriveLine className="text-text-dim" style={{ color: selectedMount?.color }} />
              </div>
              <select
                value={list.selectedMountId}
                onChange={(e) => list.setSelectedMountId(e.target.value)}
                className="w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-9 pr-8 appearance-none focus:outline-none focus:border-accent/50 text-sm shadow-sm cursor-pointer"
              >
                <option value="">All Folders</option>
                {mounts.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort / Duration / PageSize */}
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative w-full sm:w-32 flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <RiSortDesc className="text-text-dim" />
                </div>
                <select
                  value={list.sortOrder}
                  onChange={(e) => list.setSortOrder(e.target.value as SortOption)}
                  className="w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-9 pr-8 appearance-none focus:outline-none focus:border-accent/50 text-sm shadow-sm cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>

              <div className="relative w-full sm:w-28 flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <RiTimeLine className="text-text-dim" />
                </div>
                <select
                  value={list.durationFilter}
                  onChange={(e) => list.setDurationFilter(e.target.value as LenOption)}
                  className="w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-9 pr-8 appearance-none focus:outline-none focus:border-accent/50 text-sm shadow-sm cursor-pointer"
                >
                  <option value="any">Any Len</option>
                  <option value="0-5">0-5m</option>
                  <option value="5-10">5-10m</option>
                  <option value="10-30">10-30m</option>
                  <option value="30-60">30-60m</option>
                  <option value="60+">60m+</option>
                </select>
              </div>

              <div className="relative w-full sm:w-20 flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <RiLayoutGridLine className="text-text-dim" />
                </div>
                <select
                  value={list.pageSize}
                  onChange={(e) => list.setPageSize(Number(e.target.value))}
                  className="w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-9 pr-8 appearance-none focus:outline-none focus:border-accent/50 text-sm shadow-sm cursor-pointer"
                >
                  <option value="12">12</option>
                  <option value="20">20</option>
                  <option value="40">40</option>
                </select>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <SearchBar
                value={list.searchText}
                onChange={list.setSearchText}
                placeholder="Search..."
                className="flex-1"
              />
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

      <TagPinnedRow pinnedTags={settings.pinnedTags} selectedTags={list.selectedTags} onToggleTag={list.toggleTag} />

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
        searchText={list.searchText}
        selectedTags={list.selectedTags}
        mount={selectedMount ? { id: selectedMount.id, name: selectedMount.name, color: selectedMount.color } : null}
        currentPage={list.currentPage}
        totalPages={totalPages}
        onClearSearch={() => list.setSearchText('')}
        onRemoveTag={list.removeTag}
        onClearTags={list.clearAllTags}
        onClearMount={list.clearMount}
        onResetAll={list.resetAll}
      />

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-accent">
            <RiLoader4Line className="animate-spin text-4xl" />
          </div>
        ) : videos.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-dim border-2 border-dashed border-border/50 rounded-2xl">
            <RiMovieLine className="text-5xl opacity-20 mb-4" />
            <p className="text-lg font-medium">No videos found</p>
            <p className="text-sm mt-2 opacity-60">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
            <Pagination currentPage={list.currentPage} totalPages={totalPages} onPageChange={list.setCurrentPage} />
          </>
        )}
      </div>

      <TagDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ranking={tagRanking}
        rankingLoading={tagRankingLoading}
        activeTags={list.selectedTags}
        onToggleTag={list.toggleTag}
        tagSort={settings.tagSort}
      />
    </div>
  );
};

export default VideosPage;
