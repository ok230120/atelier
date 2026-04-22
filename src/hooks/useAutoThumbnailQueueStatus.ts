import { useMemo, useSyncExternalStore } from 'react';

import {
  getAutoThumbnailQueueSnapshot,
  subscribeAutoThumbnailQueue,
  type AutoThumbnailVideoStatus,
} from '../services/thumbnail';

export function useAutoThumbnailQueueStatus() {
  return useSyncExternalStore(subscribeAutoThumbnailQueue, getAutoThumbnailQueueSnapshot, getAutoThumbnailQueueSnapshot);
}

export function useAutoThumbnailVideoStatus(videoId: string, enabled = true): AutoThumbnailVideoStatus | undefined {
  const snapshot = useAutoThumbnailQueueStatus();

  return useMemo(() => {
    if (!enabled) return undefined;
    return snapshot.videoStatuses[videoId];
  }, [enabled, snapshot.videoStatuses, videoId]);
}
