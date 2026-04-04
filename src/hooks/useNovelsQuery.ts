// FILE: src/hooks/useNovelsQuery.ts
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import type { NovelSortOption } from '../types/domain';

interface UseNovelsQueryParams {
  searchText?: string;
  tags?: string[];
  favoriteOnly?: boolean;
  page?: number;
  pageSize?: number;
  sort?: NovelSortOption;
  filterMode?: 'AND' | 'OR';
}

export function useNovelsQuery(params: UseNovelsQueryParams) {
  const {
    searchText = '',
    tags = [],
    favoriteOnly = false,
    page = 1,
    pageSize = 12,
    sort = 'newest',
    filterMode = 'AND',
  } = params;

  const allNovels = useLiveQuery(() => db.novels.toArray(), []);

  const result = useMemo(() => {
    if (!allNovels) {
      return { novels: [], totalCount: 0, isLoading: true };
    }

    let filtered = [...allNovels];

    // お気に入りフィルタ
    if (favoriteOnly) {
      filtered = filtered.filter(n => n.favorite);
    }

    // タグフィルタ
    if (tags.length > 0) {
      const lowerTags = tags.map(t => t.toLowerCase());
      if (filterMode === 'AND') {
        filtered = filtered.filter(n =>
          lowerTags.every(tag => n.tags.includes(tag))
        );
      } else {
        filtered = filtered.filter(n =>
          lowerTags.some(tag => n.tags.includes(tag))
        );
      }
    }

    // 検索フィルタ（タイトルのみ）
    if (searchText.trim()) {
      const query = searchText.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(query)
      );
    }

    // ソート
    filtered.sort((a, b) => {
      switch (sort) {
        case 'wordCount':
          return (b.wordCount || 0) - (a.wordCount || 0);
        case 'favorite':
          if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
          return b.addedAt - a.addedAt;
        case 'lastRead':
          return (b.lastReadAt || 0) - (a.lastReadAt || 0);
        case 'oldest':
          return a.addedAt - b.addedAt;
        case 'newest':
        default:
          return b.addedAt - a.addedAt;
      }
    });

    const totalCount = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      novels: paged,
      totalCount,
      isLoading: false,
    };
  }, [allNovels, searchText, tags, favoriteOnly, page, pageSize, sort, filterMode]);

  return result;
}
