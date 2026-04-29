import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ImageTaggingCompletedHistoryEntry,
  ImageTagCategoryRecord,
  ImageTagRecord,
} from '../types/domain';
import {
  addTagsToImages,
  backfillImageTagReadings,
  getImageAppSettings,
  getNormalizedImageTaggingCompletedHistory,
  getImageThumbnailUrl,
  getImageTaggingMeta,
  getOrCreateImageTag,
  listImageTagCategories,
  listImageTags,
  queryImages,
  removeTagsFromImages,
  setImageAppSettings,
  sortImageTagsByUsage,
  type ImageTaggingMeta,
} from '../services/imageService';

export type ImageTaggingCompletedHistoryItem = {
  imageId: string;
  fileName: string;
  thumbnail?: string;
  completedAt: number;
  autoTags: ImageTagRecord[];
  manualTags: ImageTagRecord[];
};

export type QueueItem = {
  id: string;
  fileName: string;
  thumbnail?: string;
};

function moveTagToRecent(tagId: string, tagIds: string[]) {
  return [tagId, ...tagIds.filter((current) => current !== tagId)].slice(0, 12);
}

function toQueueItem(image: { id: string; fileName: string; thumbnail?: string }): QueueItem {
  return {
    id: image.id,
    fileName: image.fileName,
    thumbnail: image.thumbnail,
  };
}

function normalizeCompletedHistoryEntries(entries: ImageTaggingCompletedHistoryEntry[]) {
  const latestByImageId = new Map<string, ImageTaggingCompletedHistoryEntry>();

  for (const entry of entries) {
    const imageId = entry.imageId?.trim();
    if (!imageId) continue;
    const current = latestByImageId.get(imageId);
    if (!current || entry.completedAt > current.completedAt) {
      latestByImageId.set(imageId, { imageId, completedAt: entry.completedAt });
    }
  }

  return [...latestByImageId.values()]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 20);
}

function updateTagUsage(tags: ImageTagRecord[], tagId: string, delta: number) {
  return sortImageTagsByUsage(
    tags.map((tag) =>
      tag.id === tagId
        ? {
            ...tag,
            usageCount: Math.max(0, tag.usageCount + delta),
          }
        : tag,
    ),
  );
}

function upsertTag(tags: ImageTagRecord[], nextTag: ImageTagRecord, usageCount: number) {
  const existingIndex = tags.findIndex((tag) => tag.id === nextTag.id);
  if (existingIndex === -1) {
    return sortImageTagsByUsage([...tags, { ...nextTag, usageCount }]);
  }

  const nextTags = [...tags];
  nextTags[existingIndex] = {
    ...nextTags[existingIndex],
    ...nextTag,
    usageCount,
  };
  return sortImageTagsByUsage(nextTags);
}

export function useImageTaggingSession() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ImageTaggingMeta | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [categories, setCategories] = useState<ImageTagCategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<ImageTagRecord[]>([]);
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const [completedHistory, setCompletedHistory] = useState<ImageTaggingCompletedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completedIdsRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<QueueItem[]>([]);
  const selectedImageIdRef = useRef<string | null>(null);
  const thumbnailLoadingIdsRef = useRef<Set<string>>(new Set());
  const sessionLoadVersionRef = useRef(0);
  const detailLoadVersionRef = useRef(0);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    selectedImageIdRef.current = selectedImageId;
  }, [selectedImageId]);

  const hydrateCompletedHistory = useCallback(
    async (entries: ImageTaggingCompletedHistoryEntry[]) => {
      const normalizedEntries = normalizeCompletedHistoryEntries(entries);
      const hydrated = await Promise.all(
        normalizedEntries.map(async (entry) => {
          try {
            const nextDetail = await getImageTaggingMeta(entry.imageId);
            const item: ImageTaggingCompletedHistoryItem = {
              imageId: entry.imageId,
              fileName: nextDetail.image.fileName,
              completedAt: entry.completedAt,
              autoTags: nextDetail.autoTags,
              manualTags: sortImageTagsByUsage(nextDetail.manualTags),
            };
            if (nextDetail.image.thumbnail) {
              item.thumbnail = nextDetail.image.thumbnail;
            }
            return item;
          } catch {
            return null;
          }
        }),
      );

      return hydrated.filter((item): item is ImageTaggingCompletedHistoryItem => Boolean(item));
    },
    [],
  );

  const refreshQueue = useCallback(async () => {
    const version = sessionLoadVersionRef.current + 1;
    sessionLoadVersionRef.current = version;
    setLoading(true);
    setError(null);

    try {
      const [images, settings] = await Promise.all([
        queryImages({ tagIds: [], scope: 'all' }),
        getImageAppSettings(),
      ]);
      if (sessionLoadVersionRef.current !== version) return;

      const completedEntries = getNormalizedImageTaggingCompletedHistory(settings);
      completedIdsRef.current = new Set(completedEntries.map((entry) => entry.imageId));

      const visibleQueue = images
        .filter((image) => !completedIdsRef.current.has(image.id))
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((image) => toQueueItem(image));

      setQueue(visibleQueue);
      setRecentTagIds(settings.imageImportRecentTagIds ?? []);
      setSelectedImageId((prev) => {
        if (prev && visibleQueue.some((image) => image.id === prev)) return prev;
        return visibleQueue[0]?.id ?? null;
      });
      setLoading(false);

      const [nextCategories, tags, nextCompletedHistory] = await Promise.all([
        listImageTagCategories(),
        listImageTags(),
        hydrateCompletedHistory(completedEntries),
      ]);
      if (sessionLoadVersionRef.current !== version) return;

      setCategories(nextCategories);
      setAllTags(tags);
      setCompletedHistory(nextCompletedHistory);
    } catch (nextError) {
      if (sessionLoadVersionRef.current !== version) return;
      setError(nextError instanceof Error ? nextError.message : 'Failed to load tagging items.');
      setLoading(false);
    }
  }, [hydrateCompletedHistory]);

  const hydrateQueueThumbnails = useCallback(async (imageIds: string[]) => {
    const uniqueIds = Array.from(new Set(imageIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const targetIds = uniqueIds.filter((imageId) => {
      if (thumbnailLoadingIdsRef.current.has(imageId)) return false;
      const queueItem = queueRef.current.find((item) => item.id === imageId);
      return Boolean(queueItem && !queueItem.thumbnail);
    });

    if (targetIds.length === 0) return;

    for (const imageId of targetIds) {
      thumbnailLoadingIdsRef.current.add(imageId);
    }

    try {
      const results = await Promise.allSettled(
        targetIds.map(async (imageId) => ({
          imageId,
          thumbnail: await getImageThumbnailUrl(imageId),
        })),
      );

      const thumbnailMap = new Map(
        results
          .filter((result): result is PromiseFulfilledResult<{ imageId: string; thumbnail: string | null }> =>
            result.status === 'fulfilled'
          )
          .map((result) => result.value)
          .filter(
            (result): result is { imageId: string; thumbnail: string } =>
              typeof result.thumbnail === 'string' && result.thumbnail.length > 0,
          )
          .map((result) => [result.imageId, result.thumbnail]),
      );

      if (thumbnailMap.size === 0) return;

      setQueue((prev) =>
        prev.map((item) => {
          const thumbnail = thumbnailMap.get(item.id);
          return thumbnail && !item.thumbnail ? { ...item, thumbnail } : item;
        }),
      );
    } finally {
      for (const imageId of targetIds) {
        thumbnailLoadingIdsRef.current.delete(imageId);
      }
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    void backfillImageTagReadings().then(() => refreshQueue()).catch(() => undefined);
  }, [refreshQueue]);

  useEffect(() => {
    if (!selectedImageId) {
      detailLoadVersionRef.current += 1;
      setDetail(null);
      setDetailLoading(false);
      return;
    }

    const version = detailLoadVersionRef.current + 1;
    detailLoadVersionRef.current = version;
    setDetail(null);
    setDetailLoading(true);

    void getImageTaggingMeta(selectedImageId)
      .then((nextDetail) => {
        if (detailLoadVersionRef.current !== version || selectedImageIdRef.current !== selectedImageId) return;
        setDetail(nextDetail);
        setDetailLoading(false);
      })
      .catch((nextError) => {
        if (detailLoadVersionRef.current !== version || selectedImageIdRef.current !== selectedImageId) return;
        setError(nextError instanceof Error ? nextError.message : 'Failed to load the image detail.');
        setDetailLoading(false);
      });
  }, [selectedImageId]);

  const recentTags = useMemo(
    () =>
      recentTagIds
        .map((tagId) => allTags.find((tag) => tag.id === tagId) ?? null)
        .filter((tag): tag is ImageTagRecord => Boolean(tag)),
    [allTags, recentTagIds],
  );

  const updateRecentImageTags = useCallback(async (tagId: string) => {
    const settings = await getImageAppSettings();
    const nextSettings = await setImageAppSettings({
      ...settings,
      imageImportRecentTagIds: moveTagToRecent(tagId, settings.imageImportRecentTagIds ?? []),
    });
    setRecentTagIds(nextSettings.imageImportRecentTagIds ?? []);
  }, []);

  const selectImage = (imageId: string) => {
    setSelectedImageId(imageId);
  };

  const addManualTag = async (tagId: string) => {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);

    try {
      const imageId = detail.image.id;
      await addTagsToImages([imageId], [tagId]);
      await updateRecentImageTags(tagId);
      const version = detailLoadVersionRef.current + 1;
      detailLoadVersionRef.current = version;
      const nextDetail = await getImageTaggingMeta(imageId);
      if (detailLoadVersionRef.current === version && selectedImageIdRef.current === imageId) {
        setDetail(nextDetail);
      }
      setAllTags((prev) => updateTagUsage(prev, tagId, 1));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to add the tag.');
    } finally {
      setBusy(false);
    }
  };

  const removeManualTag = async (tagId: string) => {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);

    try {
      const imageId = detail.image.id;
      await removeTagsFromImages([imageId], [tagId]);
      const version = detailLoadVersionRef.current + 1;
      detailLoadVersionRef.current = version;
      const nextDetail = await getImageTaggingMeta(imageId);
      if (detailLoadVersionRef.current === version && selectedImageIdRef.current === imageId) {
        setDetail(nextDetail);
      }
      setAllTags((prev) => updateTagUsage(prev, tagId, -1));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to remove the tag.');
    } finally {
      setBusy(false);
    }
  };

  const createAndAddTag = async (name: string, categoryId: string) => {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);

    try {
      const imageId = detail.image.id;
      const tag = await getOrCreateImageTag(name, categoryId);
      await addTagsToImages([imageId], [tag.id]);
      await updateRecentImageTags(tag.id);
      const version = detailLoadVersionRef.current + 1;
      detailLoadVersionRef.current = version;
      const nextDetail = await getImageTaggingMeta(imageId);
      if (detailLoadVersionRef.current === version && selectedImageIdRef.current === imageId) {
        setDetail(nextDetail);
      }
      setAllTags((prev) => {
        const existing = prev.find((current) => current.id === tag.id);
        return upsertTag(prev, tag, Math.max(1, (existing?.usageCount ?? tag.usageCount) + 1));
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to create and add the tag.');
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (!detail || busy) return;
    setBusy(true);
    setError(null);

    try {
      const completedAt = Date.now();
      const currentImageId = detail.image.id;
      const settings = await getImageAppSettings();
      const nextHistory = normalizeCompletedHistoryEntries([
        { imageId: currentImageId, completedAt },
        ...(settings.taggingCompletedHistory ?? []),
      ]);
      const currentIndex = queue.findIndex((item) => item.id === currentImageId);
      const nextQueue = queue.filter((item) => item.id !== currentImageId);
      const nextSelectedItem = nextQueue[currentIndex] ?? nextQueue[currentIndex - 1] ?? null;

      completedIdsRef.current.add(currentImageId);
      await setImageAppSettings({
        ...settings,
        taggingCompletedHistory: nextHistory,
      });
      setCompletedHistory((prev) =>
        [
          {
            imageId: currentImageId,
            fileName: detail.image.fileName,
            thumbnail: detail.image.thumbnail,
            completedAt,
            autoTags: detail.autoTags,
            manualTags: sortImageTagsByUsage(detail.manualTags),
          },
          ...prev.filter((item) => item.imageId !== detail.image.id),
        ].slice(0, 20),
      );
      setQueue(nextQueue);
      setSelectedImageId(nextSelectedItem?.id ?? null);
      if (!nextSelectedItem) {
        setDetail(null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to move to the next image.');
    } finally {
      setBusy(false);
    }
  };

  return {
    loading,
    detailLoading,
    busy,
    error,
    queue,
    categories,
    allTags,
    selectedImageId,
    detail,
    recentTags,
    completedHistory,
    selectImage,
    addManualTag,
    removeManualTag,
    createAndAddTag,
    goNext,
    hydrateQueueThumbnails,
    refreshQueue,
  };
}
