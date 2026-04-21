import { useEffect } from 'react';
import type { Video } from '../types/domain';
import { queueAutoThumbnailGenerationForVideos } from '../services/thumbnail';

export function useVideoDerivedDataQueue(videos: Video[]) {
  useEffect(() => {
    if (videos.length === 0) return;
    queueAutoThumbnailGenerationForVideos(videos);
  }, [videos]);
}
