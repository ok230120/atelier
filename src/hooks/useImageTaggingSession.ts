import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ImageRecord,
  ImageTagCategoryRecord,
  ImageTagRecord,
} from '../types/domain';
import {
  addTagsToImages,
  backfillImageTagReadings,
  getImageAppSettings,
  getImageManualTagIds,
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

function moveTagToRecent(tagId: string, tagIds: string[]) {
  return [tagId, ...tagIds.filter((current) => current !== tagId)].slice(0, 12);
}

export function useImageTaggingSession() {
  const [queue, setQueue] = useState<ImageRecord[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ImageTaggingMeta | null>(null);
  const [categories, setCategories] = useState<ImageTagCategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<ImageTagRecord[]>([]);
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const [completedHistory, setCompletedHistory] = useState<ImageTaggingCompletedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  const refreshQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [images, nextCategories, tags, settings] = await Promise.all([
        queryImages({ tagIds: [], scope: 'all' }),
        listImageTagCategories(),
        listImageTags(),
        getImageAppSettings(),
      ]);

      const visibleImages = images
        .filter((image) => !dismissedIdsRef.current.has(image.id))
        .filter((image) => getImageManualTagIds(image).length === 0)
        .sort((a, b) => b.addedAt - a.addedAt);

      setQueue(visibleImages);
      setCategories(nextCategories);
      setAllTags(tags);
      setRecentTagIds(settings.imageImportRecentTagIds ?? []);
      setSelectedImageId((prev) => {
        if (prev && visibleImages.some((image) => image.id === prev)) return prev;
        return visibleImages[0]?.id ?? null;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load tagging items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshQueue();
    void backfillImageTagReadings().then(() => refreshQueue()).catch(() => undefined);
  }, [refreshQueue]);

  useEffect(() => {
    if (!selectedImageId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    void getImageTaggingMeta(selectedImageId).then((nextDetail) => {
      if (!cancelled) setDetail(nextDetail);
    });

    return () => {
      cancelled = true;
    };
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
      await addTagsToImages([detail.image.id], [tagId]);
      await updateRecentImageTags(tagId);
      const [nextDetail, tags] = await Promise.all([
        getImageTaggingMeta(detail.image.id),
        listImageTags(),
      ]);
      setDetail(nextDetail);
      setAllTags(tags);
      await refreshQueue();
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
      await removeTagsFromImages([detail.image.id], [tagId]);
      const [nextDetail, tags] = await Promise.all([
        getImageTaggingMeta(detail.image.id),
        listImageTags(),
      ]);
      setDetail(nextDetail);
      setAllTags(tags);
      await refreshQueue();
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
      const tag = await getOrCreateImageTag(name, categoryId);
      await addTagsToImages([detail.image.id], [tag.id]);
      await updateRecentImageTags(tag.id);
      const [nextDetail, tags] = await Promise.all([
        getImageTaggingMeta(detail.image.id),
        listImageTags(),
      ]);
      setDetail(nextDetail);
      setAllTags(tags);
      await refreshQueue();
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
      dismissedIdsRef.current.add(detail.image.id);
      setCompletedHistory((prev) => [
        {
          imageId: detail.image.id,
          fileName: detail.image.fileName,
          thumbnail: detail.image.thumbnail,
          completedAt: Date.now(),
          autoTags: detail.autoTags,
          manualTags: sortImageTagsByUsage(detail.manualTags),
        },
        ...prev.filter((item) => item.imageId !== detail.image.id),
      ].slice(0, 20));
      await refreshQueue();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to move to the next image.');
    } finally {
      setBusy(false);
    }
  };

  return {
    loading,
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
    refreshQueue,
  };
}
