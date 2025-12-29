// FILE: src/hooks/useTagRankingQuery.ts
import { useLiveQuery } from 'dexie-react-hooks';
import Dexie from 'dexie';
import { db } from '../db/client';
import type { Video } from '../types/domain';
import type { RankedTag } from './useTagRanking';

export interface UseTagRankingQueryProps {
  searchText?: string;
  tags?: string[];
  mountId?: string;
  favoritesOnly?: boolean;
  filterMode?: 'AND' | 'OR';
  minDuration?: number;
  maxDuration?: number;
  tagSort?: 'popular' | 'alpha';
}

export function useTagRankingQuery({
  searchText = '',
  tags = [],
  mountId,
  favoritesOnly = false,
  filterMode = 'AND',
  minDuration,
  maxDuration,
  tagSort = 'popular',
}: UseTagRankingQueryProps): { ranking: RankedTag[]; isLoading: boolean } {
  const normalizedSearch = searchText.toLowerCase().trim();

  const result = useLiveQuery(async () => {
    let collection: Dexie.Collection<Video, string>;

    // No need for ordering here; we only iterate.
    if (mountId) {
      collection = db.videos
        .where('[mountId+addedAt]')
        .between([mountId, Dexie.minKey], [mountId, Dexie.maxKey]);
    } else {
      collection = db.videos.toCollection();
    }

    const filtered = collection.filter((video: Video) => {
      // Favorites
      if (favoritesOnly && !video.favorite) return false;

      // Duration (if min/max set, exclude unknown duration)
      if (minDuration !== undefined || maxDuration !== undefined) {
        const d = video.durationSec;
        if (d === undefined) return false;
        if (minDuration !== undefined && d < minDuration) return false;
        if (maxDuration !== undefined && d >= maxDuration) return false;
      }

      // Tags
      const vtags = video.tags ?? [];
      if (tags.length > 0) {
        if (filterMode === 'OR') {
          if (!tags.some((t) => vtags.includes(t))) return false;
        } else {
          if (!tags.every((t) => vtags.includes(t))) return false;
        }
      }

      // Search
      if (normalizedSearch) {
        const title = (video.titleOverride || video.filename || '').toLowerCase();
        const titleMatch = title.includes(normalizedSearch);
        const tagMatch = vtags.some((t) => t.toLowerCase().includes(normalizedSearch));
        if (!titleMatch && !tagMatch) return false;
      }

      return true;
    });

    const counts = new Map<string, number>();
    await filtered.each((v) => {
      for (const t of v.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    });

    const ranking: RankedTag[] = Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    if (tagSort === 'popular') {
      ranking.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    } else {
      ranking.sort((a, b) => a.name.localeCompare(b.name));
    }

    return ranking;
  }, [searchText, tags, mountId, favoritesOnly, filterMode, minDuration, maxDuration, tagSort]);

  return {
    ranking: result ?? [],
    isLoading: result === undefined,
  };
}