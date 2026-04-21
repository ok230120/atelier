// FILE: src/pages/favorites/FavoritesPage.tsx
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiFilter3Line,
  RiLoader4Line,
  RiHeart3Line,
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
import { needsRelinkMount } from '../../utils/mounts';

import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';
import TagPinnedRow from '../../components/TagPinnedRow';
import ActiveFiltersBar from '../../components/ActiveFiltersBar';
import {
  listControlButtonClassName,
  listControlFieldClassName,
  listControlIconClassName,
  listControlWidthClassNames,
} from '../../components/listControls';
import VideoCard from '../videos/components/VideoCard';
import TagDrawer from '../videos/components/TagDrawer';

const FavoritesPage: React.FC = () => {
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
    favoritesOnly: true,
    filterMode: settings.filterMode,
    minDuration: list.minDurationSec,
    maxDuration: list.maxDurationSec,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / list.pageSize) || 1);
  const selectedMount = mounts.find((m) => m.id === list.selectedMountId);

  const mountsNeedRelink = useMemo(() => mounts.filter(needsRelinkMount), [mounts]);

  const { ranking: tagRanking, isLoading: tagRankingLoading } = useTagRankingQuery({
    searchText: list.searchText,
    tags: list.selectedTags,
    mountId: list.selectedMountId || undefined,
    favoritesOnly: true,
    filterMode: settings.filterMode,
    minDuration: list.minDurationSec,
    maxDuration: list.maxDurationSec,
    tagSort: settings.tagSort,
  });

  const selectClassName = `${listControlFieldClassName} placeholder-text-dim`;

  return (
    <div className="flex h-full flex-col space-y-6 relative">
      {mountsNeedRelink.length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium">リンクが切れたフォルダがあります</div>
              <div className="mt-0.5 text-xs text-orange-200/80">
                権限やインポート後のフォルダハンドルを再設定できないため、再リンクが必要になる場合があります。
              </div>
            </div>
            <Link
              to="/manage"
              className="inline-flex items-center justify-center rounded-xl border border-orange-500/30 bg-bg-panel px-3 py-2 text-xs transition-colors hover:border-orange-400/60"
            >
              管理を開く
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="font-heading flex items-center gap-2 text-2xl font-bold">
            お気に入り <RiHeart3Line className="text-red-500 text-xl" />
          </h2>
          <p className="mt-1 text-sm text-text-dim">{totalCount} 件の動画</p>
        </div>

        <div className="w-full xl:flex-1 xl:min-w-0">
          <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap xl:justify-end">
            <div className={`relative w-full flex-shrink-0 ${listControlWidthClassNames.folder}`}>
              <div className={listControlIconClassName}>
                <RiHardDriveLine className="text-text-dim" style={{ color: selectedMount?.color }} />
              </div>
              <select
                value={list.selectedMountId}
                onChange={(e) => list.setSelectedMountId(e.target.value)}
                className={selectClassName}
              >
                <option value="">すべてのフォルダ</option>
                {mounts.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={`relative w-full flex-shrink-0 ${listControlWidthClassNames.sort}`}>
              <div className={listControlIconClassName}>
                <RiSortDesc className="text-text-dim" />
              </div>
              <select
                value={list.sortOrder}
                onChange={(e) => list.setSortOrder(e.target.value as SortOption)}
                className={selectClassName}
              >
                <option value="newest">新しい順</option>
                <option value="oldest">古い順</option>
                <option value="recentlyPlayed">最近見た順</option>
                <option value="mostPlayed">再生回数順</option>
              </select>
            </div>

            <div className={`relative w-full flex-shrink-0 ${listControlWidthClassNames.duration}`}>
              <div className={listControlIconClassName}>
                <RiTimeLine className="text-text-dim" />
              </div>
              <select
                value={list.durationFilter}
                onChange={(e) => list.setDurationFilter(e.target.value as LenOption)}
                className={selectClassName}
              >
                <option value="any">長さ指定なし</option>
                <option value="0-5">0-5m</option>
                <option value="5-10">5-10m</option>
                <option value="10-30">10-30m</option>
                <option value="30-60">30-60m</option>
                <option value="60+">60m+</option>
              </select>
            </div>

            <div className={`relative w-full flex-shrink-0 ${listControlWidthClassNames.pageSize}`}>
              <div className={listControlIconClassName}>
                <RiLayoutGridLine className="text-text-dim" />
              </div>
              <select
                value={list.pageSize}
                onChange={(e) => list.setPageSize(Number(e.target.value))}
                className={selectClassName}
              >
                <option value="12">12</option>
                <option value="20">20</option>
                <option value="40">40</option>
              </select>
            </div>

            <div className={`flex gap-2 ${listControlWidthClassNames.search}`}>
              <SearchBar
                value={list.searchText}
                onChange={list.setSearchText}
                placeholder="お気に入りを検索..."
                className="flex-1 min-w-0"
                size="list"
              />
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className={`${listControlButtonClassName} ${listControlWidthClassNames.tagButton}`}
                title="タグフィルターを開く"
              >
                <RiFilter3Line />
                <span className="hidden text-sm sm:inline">タグ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

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

      <TagPinnedRow pinnedTags={settings.pinnedTags} selectedTags={list.selectedTags} onToggleTag={list.toggleTag} />

      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-accent">
            <RiLoader4Line className="animate-spin text-4xl" />
          </div>
        ) : videos.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/50 text-text-dim">
            <RiHeart3Line className="mb-4 text-5xl opacity-20" />
            <p className="text-lg font-medium">お気に入りの動画が見つかりません</p>
            <p className="mt-2 text-sm opacity-60">検索条件やフィルターを見直してください。</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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

export default FavoritesPage;
