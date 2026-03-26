// FILE: src/hooks/useNovelTagRanking.ts
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';

interface TagCount {
  tag: string;
  count: number;
}

interface UseNovelTagRankingParams {
  favoriteOnly?: boolean;
  tagSort?: 'popular' | 'alpha';
}

export function useNovelTagRanking(params: UseNovelTagRankingParams = {}) {
  const { favoriteOnly = false, tagSort = 'popular' } = params;

  const novels = useLiveQuery(() => db.novels.toArray(), []);

  const result = useMemo(() => {
    if (!novels) {
      return { ranking: [], isLoading: true };
    }

    let filtered = novels;
    if (favoriteOnly) {
      filtered = filtered.filter(n => n.favorite);
    }

    // タグをカウント
    const tagMap = new Map<string, number>();
    for (const novel of filtered) {
      for (const tag of novel.tags) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }

    // ランキング作成
    let ranking: TagCount[] = Array.from(tagMap.entries()).map(([tag, count]) => ({
      tag,
      count,
    }));

    // ソート
    if (tagSort === 'popular') {
      ranking.sort((a, b) => b.count - a.count);
    } else {
      ranking.sort((a, b) => a.tag.localeCompare(b.tag));
    }

    return {
      ranking,
      isLoading: false,
    };
  }, [novels, favoriteOnly, tagSort]);

  return result;
}