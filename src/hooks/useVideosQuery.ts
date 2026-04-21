// FILE: src/hooks/useVideosQuery.ts
import { useLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';
import { db } from '../db/client';
import type { Video } from '../types/domain';

interface UseVideosQueryProps {
  searchText?: string;
  tags?: string[];
  mountId?: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'recentlyPlayed' | 'mostPlayed';
  favoritesOnly?: boolean;
  filterMode?: 'AND' | 'OR';
  minDuration?: number;
  maxDuration?: number;
  excludeMissing?: boolean;
}

interface UseVideosQueryResult {
  videos: Video[];
  totalCount: number;
  isLoading: boolean;
  error?: Error;
}

export const useVideosQuery = ({
  searchText = '',
  tags = [],
  mountId,
  page = 1,
  pageSize = 20,
  sort = 'newest',
  favoritesOnly = false,
  filterMode = 'AND',
  minDuration,
  maxDuration,
  excludeMissing = true,
}: UseVideosQueryProps): UseVideosQueryResult => {
  const normalizedSearch = searchText.toLowerCase().trim();

  const result = useLiveQuery(
    async () => {
      let collection: Dexie.Collection<Video, string>;

      if (mountId) {
        collection = db.videos
          .where('[mountId+addedAt]')
          .between([mountId, Dexie.minKey], [mountId, Dexie.maxKey]);
      } else if (favoritesOnly) {
        collection = db.videos.where('favorite').equals(1);
      } else if (excludeMissing) {
        collection = db.videos.where('isMissing').notEqual(1);
      } else if (sort === 'recentlyPlayed') {
        collection = db.videos.orderBy('lastPlayedAt').reverse();
      } else if (sort === 'mostPlayed') {
        collection = db.videos.orderBy('playCount').reverse();
      } else {
        collection = db.videos.orderBy('addedAt');
        if (sort === 'newest') {
          collection = collection.reverse();
        }
      }

      // 2) In-memory Filtering
      const filtered = collection.filter((video: Video) => {
        // Favorites check
        if (favoritesOnly && !video.favorite) return false;
        if (excludeMissing && video.isMissing) return false;
        if (mountId && video.mountId !== mountId) return false;

        // Duration check
        // If min/max are set, we exclude videos with undefined duration.
        if (minDuration !== undefined || maxDuration !== undefined) {
          const d = video.durationSec;
          if (d === undefined) return false;
          if (minDuration !== undefined && d < minDuration) return false;
          if (maxDuration !== undefined && d >= maxDuration) return false;
        }

        // Tag filtering
        const vtags = video.tags ?? [];
        if (tags.length > 0) {
          if (filterMode === 'OR') {
            if (!tags.some((t) => vtags.includes(t))) return false;
          } else {
            if (!tags.every((t) => vtags.includes(t))) return false;
          }
        }

        // Text search
        if (normalizedSearch) {
          const title = (video.titleOverride || video.filename || '').toLowerCase();
          const titleMatch = title.includes(normalizedSearch);
          const tagMatch = vtags.some((t) => t.toLowerCase().includes(normalizedSearch));
          if (!titleMatch && !tagMatch) return false;
        }

        return true;
      });

      let filteredArray = await filtered.toArray();

      if (sort === 'recentlyPlayed') {
        filteredArray.sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0) || b.addedAt - a.addedAt);
      } else if (sort === 'mostPlayed') {
        filteredArray.sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0) || b.addedAt - a.addedAt);
      } else if (sort === 'newest') {
        filteredArray.sort((a, b) => b.addedAt - a.addedAt);
      } else {
        filteredArray.sort((a, b) => a.addedAt - b.addedAt);
      }

      const totalCount = filteredArray.length;

      const offset = (page - 1) * pageSize;
      const videos = filteredArray.slice(offset, offset + pageSize);

      return { videos, totalCount };
    },
    [
      searchText,
      tags,
      mountId,
      page,
      pageSize,
      sort,
      favoritesOnly,
      filterMode,
      minDuration,
      maxDuration,
      excludeMissing,
    ],
  );

  return {
    videos: result?.videos || [],
    totalCount: result?.totalCount || 0,
    isLoading: result === undefined,
  };
};
