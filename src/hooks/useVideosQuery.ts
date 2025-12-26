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
  sort?: 'newest' | 'oldest' | 'popular';
  favoritesOnly?: boolean;
  filterMode?: 'AND' | 'OR';
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
}: UseVideosQueryProps): UseVideosQueryResult => {
  const normalizedSearch = searchText.toLowerCase().trim();

  const result = useLiveQuery(async () => {
    let collection: Dexie.Collection<Video, string>;

    // 1) mount絞り込みがある場合は、複合インデックスで「mountId + addedAt」を高速に取る
    if (mountId) {
      // v2の複合インデックスがある前提（schema.tsでversion(2)追加済み）
      collection = db.videos
        .where('[mountId+addedAt]')
        .between([mountId, Dexie.minKey], [mountId, Dexie.maxKey]);
    } else {
      collection = db.videos.orderBy('addedAt');
    }

    // newest/oldest
    if (sort === 'newest') {
      collection = collection.reverse();
    }
    // popular は将来対応（playCount等の設計が固まったら）
    // if (sort === 'popular') { ... }

    // 2) JS側フィルタ（タグ・検索など）
    const filtered = collection.filter((video: Video) => {
      if (favoritesOnly && !video.favorite) return false;

      const vtags = video.tags ?? [];

      if (tags.length > 0) {
        if (filterMode === 'OR') {
          if (!tags.some((t) => vtags.includes(t))) return false;
        } else {
          if (!tags.every((t) => vtags.includes(t))) return false;
        }
      }

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
  }, [searchText, tags, mountId, page, pageSize, sort, favoritesOnly, filterMode]);

  return {
    videos: result?.videos || [],
    totalCount: result?.totalCount || 0,
    isLoading: result === undefined,
  };
};
