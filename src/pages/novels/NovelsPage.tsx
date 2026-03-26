// FILE: src/pages/novels/NovelsPage.tsx (更新版 - シリーズフィルタ追加)
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiFilter3Line,
  RiLoader4Line,
  RiBookOpenLine,
  RiSortDesc,
  RiLayoutGridLine,
  RiAddLine,
  RiBookmarkLine,
} from 'react-icons/ri';

import { db } from '../../db/schema';
import { useNovelsQuery } from '../../hooks/useNovelsQuery';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useNovelListUrlState } from '../../hooks/useNovelListUrlState';
import { useNovelTagRanking } from '../../hooks/useNovelTagRanking';

import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';
import TagPinnedRow from '../../components/TagPinnedRow';
import ActiveFiltersBar from '../../components/ActiveFiltersBar';
import NovelCard from './components/NovelCard';
import NovelTagDrawer from './components/NovelTagDrawer';

const NovelsPage: React.FC = () => {
  const settings = useAppSettings();
  const list = useNovelListUrlState();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // シリーズ一覧を取得
  const allSeries = useLiveQuery(() => db.series.toArray(), []) || [];

  const { novels, totalCount, isLoading } = useNovelsQuery({
    searchText: list.searchText,
    tags: list.selectedTags,
    page: list.currentPage,
    pageSize: list.pageSize,
    sort: list.sortOrder,
    filterMode: settings.filterMode,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / list.pageSize) || 1);

  const { ranking: tagRanking, isLoading: tagRankingLoading } = useNovelTagRanking({
    favoriteOnly: false,
    tagSort: settings.tagSort,
  });

  // シリーズフィルタ
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');

  // シリーズでフィルタリング
  const filteredNovels = selectedSeriesId
    ? novels.filter((n) => n.seriesId === selectedSeriesId)
    : novels;

  const selectedSeries = allSeries.find((s) => s.id === selectedSeriesId);

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Novels</h2>
          <p className="text-text-dim text-sm mt-1">{totalCount} novels found</p>
        </div>

        <div className="flex flex-col gap-3 w-full xl:w-auto">
          <div className="flex flex-col md:flex-row gap-2 w-full">
            {/* Series Filter */}
            <div className="relative w-full md:w-48 flex-shrink-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <RiBookmarkLine className="text-text-dim" />
              </div>
              <select
                value={selectedSeriesId}
                onChange={(e) => setSelectedSeriesId(e.target.value)}
                className="w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-9 pr-8 appearance-none focus:outline-none focus:border-accent/50 text-sm shadow-sm cursor-pointer"
              >
                <option value="">All Series</option>
                {allSeries.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort / PageSize */}
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative w-full sm:w-40 flex-shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <RiSortDesc className="text-text-dim" />
                </div>
                <select
                  value={list.sortOrder}
                  onChange={(e) => list.setSortOrder(e.target.value as any)}
                  className="w-full bg-bg-panel border border-border text-text-main rounded-xl py-2.5 pl-9 pr-8 appearance-none focus:outline-none focus:border-accent/50 text-sm shadow-sm cursor-pointer"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="wordCount">Word Count</option>
                  <option value="favorite">Favorites</option>
                  <option value="lastRead">Last Read</option>
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

            {/* Search Bar + New Button */}
            <div className="flex gap-2 flex-1 min-w-[200px]">
              <SearchBar
                value={list.searchText}
                onChange={list.setSearchText}
                placeholder="Search novels..."
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
              <Link
                to="/novels/edit"
                className="px-3 py-2 bg-accent border border-accent/50 rounded-xl text-white hover:bg-accent/90 transition-colors flex items-center gap-2 shadow-lg shadow-accent/20"
                title="Create New Novel"
              >
                <RiAddLine />
                <span className="hidden sm:inline text-sm font-medium">New</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <TagPinnedRow
        pinnedTags={settings.pinnedNovelTags || []}
        selectedTags={list.selectedTags}
        onToggleTag={list.toggleTag}
      />

      {/* シリーズフィルタ表示 */}
      {selectedSeries && (
        <div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/30 rounded-xl">
          <RiBookmarkLine className="text-accent" />
          <span className="text-sm text-text-main">
            Filtered by series: <span className="font-semibold">{selectedSeries.name}</span>
          </span>
          <button
            onClick={() => setSelectedSeriesId('')}
            className="ml-auto px-3 py-1 text-xs bg-bg-panel border border-border rounded-lg text-text-main hover:border-accent/50 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <ActiveFiltersBar
        searchText={list.searchText}
        selectedTags={list.selectedTags}
        mount={null}
        currentPage={list.currentPage}
        totalPages={totalPages}
        onClearSearch={() => list.setSearchText('')}
        onRemoveTag={list.removeTag}
        onClearTags={list.clearAllTags}
        onClearMount={() => {}}
        onResetAll={list.resetAll}
      />

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-accent">
            <RiLoader4Line className="animate-spin text-4xl" />
          </div>
        ) : filteredNovels.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-dim border-2 border-dashed border-border/50 rounded-2xl">
            <RiBookOpenLine className="text-5xl opacity-20 mb-4" />
            <p className="text-lg font-medium">No novels found</p>
            <p className="text-sm mt-2 opacity-60">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            {/* 2カラムグリッド（1列2枚） */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredNovels.map((novel) => (
                <NovelCard key={novel.id} novel={novel} />
              ))}
            </div>
            <Pagination currentPage={list.currentPage} totalPages={totalPages} onPageChange={list.setCurrentPage} />
          </>
        )}
      </div>

      <NovelTagDrawer
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

export default NovelsPage;