// FILE: src/hooks/useTagRanking.ts
import { useMemo } from 'react';
import type { Video } from '../types/domain';

export interface RankedTag {
  name: string;
  count: number;
}

/**
 * Calculate tag ranking from a list of videos.
 */
export function useTagRanking(
  videos: Video[],
  sortMode: 'popular' | 'alpha' = 'popular',
): RankedTag[] {
  return useMemo(() => {
    const tagCounts = new Map<string, number>();

    for (const video of videos) {
      for (const tag of video.tags || []) {
        const normalized = tag.toLowerCase();
        tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
      }
    }

    const ranking: RankedTag[] = Array.from(tagCounts.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    if (sortMode === 'popular') {
      ranking.sort((a, b) => (b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name)));
    } else {
      ranking.sort((a, b) => a.name.localeCompare(b.name));
    }

    return ranking;
  }, [videos, sortMode]);
}
