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
  sort?: 'newest' | 'oldest';
  favoritesOnly?: boolean;
  filterMode?: 'AND' | 'OR';
  minDuration?: number;
  maxDuration?: number;
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
}: UseVideosQueryProps): UseVideosQueryResult => {
  const normalizedSearch = searchText.toLowerCase().trim();

  const result = useLiveQuery(
    async () => {
      let collection: Dexie.Collection<Video, string>;

      // 1) Initial Collection Selection
      if (mountId) {
        // Use compound index [mountId+addedAt]
        collection = db.videos
          .where('[mountId+addedAt]')
          .between([mountId, Dexie.minKey], [mountId, Dexie.maxKey]);
      } else {
        // Default ordering by addedAt
        collection = db.videos.orderBy('addedAt');
      }

      // Apply sorting direction
      // 'oldest' is the natural order of addedAt (ascending).
      // 'newest' requires reversing the collection (descending).
      if (sort === 'newest') {
        collection = collection.reverse();
      }

      // 2) In-memory Filtering
      const filtered = collection.filter((video: Video) => {
        // Favorites check
        if (favoritesOnly && !video.favorite) return false;

        // Duration check
        // If min/max are set, we exclude videos with undefined duration.
        if (minDuration !== undefined || maxDuration !== undefined) {
          const d = video.durationSec;
          if (d === undefined) return false;
          if (minDuration !== undefined && d < minDuration) return false;
          if (maxDuration !== undefined && d > maxDuration) return false; // upper bound is exclusive
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

      const totalCount = await filtered.count();

      const offset = (page - 1) * pageSize;
      const videos = await filtered.offset(offset).limit(pageSize).toArray();

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
    ],
  );

  return {
    videos: result?.videos || [],
    totalCount: result?.totalCount || 0,
    isLoading: result === undefined,
  };
};
