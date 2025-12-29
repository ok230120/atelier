// FILE: src/hooks/useAllTagsQuery.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/client';
import type { Video } from '../types/domain';

export function useAllTagsQuery(opts?: { mountId?: string; enabled?: boolean }) {
  const mountId = opts?.mountId;
  const enabled = opts?.enabled ?? true;

  const result = useLiveQuery(async () => {
    // Drawer閉じてるなら何もしない（重い集計を回避）
    if (!enabled) return [];

    const map = new Map<string, number>();

    const col = mountId
      ? db.videos.where('mountId').equals(mountId)
      : db.videos.toCollection();

    await col.each((v: Video) => {
      for (const t of v.tags ?? []) {
        const tag = (t ?? '').trim().toLowerCase();
        if (!tag) continue;
        map.set(tag, (map.get(tag) ?? 0) + 1);
      }
    });

    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [mountId, enabled]);

  return {
    tags: result ?? [],
    // enabled=false のときは読み込み扱いにしない
    isLoading: enabled ? result === undefined : false,
  };
}
