// FILE: src/hooks/useNovelListUrlState.ts
import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import type { NovelSortOption } from '../types/domain';

export function useNovelListUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();

  // 検索テキスト
  const searchText = searchParams.get('q') || '';
  const setSearchText = useCallback((text: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (text) {
        next.set('q', text);
      } else {
        next.delete('q');
      }
      next.delete('page'); // 検索時はページをリセット
      return next;
    });
  }, [setSearchParams]);

  // タグ
  const selectedTags = useMemo(() => {
    const tagsParam = searchParams.get('tags');
    return tagsParam ? tagsParam.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const toggleTag = useCallback((tag: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const current = next.get('tags')?.split(',').filter(Boolean) || [];
      const updated = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      
      if (updated.length > 0) {
        next.set('tags', updated.join(','));
      } else {
        next.delete('tags');
      }
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const removeTag = useCallback((tag: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const current = next.get('tags')?.split(',').filter(Boolean) || [];
      const updated = current.filter(t => t !== tag);
      
      if (updated.length > 0) {
        next.set('tags', updated.join(','));
      } else {
        next.delete('tags');
      }
      return next;
    });
  }, [setSearchParams]);

  const clearAllTags = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('tags');
      return next;
    });
  }, [setSearchParams]);

  // ソート
  const sortOrder = (searchParams.get('sort') as NovelSortOption) || 'newest';
  const setSortOrder = useCallback((sort: NovelSortOption) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('sort', sort);
      return next;
    });
  }, [setSearchParams]);

  // ページネーション
  const currentPage = Number(searchParams.get('page')) || 1;
  const setCurrentPage = useCallback((page: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(page));
      return next;
    });
  }, [setSearchParams]);

  const pageSize = Number(searchParams.get('perPage')) || 12;
  const setPageSize = useCallback((size: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('perPage', String(size));
      next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  // リセット
  const resetAll = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  return {
    searchText,
    setSearchText,
    selectedTags,
    toggleTag,
    removeTag,
    clearAllTags,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    resetAll,
  };
}