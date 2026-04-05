import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../db/client';
import type {
  AppSettings,
  ImageRecord,
  ImageTagCategoryRecord,
  ImageTagRecord,
} from '../types/domain';
import {
  addTagsToImages,
  getImageManualTagIds,
  getImageTaggingMeta,
  getOrCreateImageTag,
  listImageTagCategories,
  listImageTags,
  removeTagsFromImages,
  type ImageTaggingMeta,
} from '../services/imageService';

const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app' as const,
  schemaVersion: 1,
  pinnedTags: [],
  tagSort: 'popular' as const,
  filterMode: 'AND' as const,
  thumbStore: 'idb' as const,
};

function moveTagToRecent(tagId: string, tagIds: string[]) {
  return [tagId, ...tagIds.filter((current) => current !== tagId)].slice(0, 12);
}

async function getAppSettings(): Promise<AppSettings> {
  return (await db.settings.get('app')) ?? DEFAULT_APP_SETTINGS;
}

async function updateRecentImageTags(tagId: string) {
  const settings = await getAppSettings();

  await db.settings.put({
    ...settings,
    imageImportRecentTagIds: moveTagToRecent(tagId, settings.imageImportRecentTagIds ?? []),
  });
}

async function dismissImageFromTagging(imageId: string) {
  const settings = await getAppSettings();
  const nextDismissedIds = Array.from(
    new Set([...(settings.taggingDismissedImageIds ?? []), imageId]),
  );

  await db.settings.put({
    ...settings,
    taggingDismissedImageIds: nextDismissedIds,
    taggingPendingImageIds: (settings.taggingPendingImageIds ?? []).filter(
      (currentId) => currentId !== imageId,
    ),
  });
}

async function setImageTaggingPending(imageId: string, shouldKeepPending: boolean) {
  const settings = await getAppSettings();
  const pendingIds = new Set(settings.taggingPendingImageIds ?? []);

  if (shouldKeepPending) pendingIds.add(imageId);
  else pendingIds.delete(imageId);

  await db.settings.put({
    ...settings,
    taggingPendingImageIds: Array.from(pendingIds),
  });
}

export function useImageTaggingSession() {
  const [queue, setQueue] = useState<ImageRecord[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ImageTaggingMeta | null>(null);
  const [categories, setCategories] = useState<ImageTagCategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<ImageTagRecord[]>([]);
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshQueue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [images, nextCategories, tags, settings] = await Promise.all([
        db.images.toArray(),
        listImageTagCategories(),
        listImageTags(),
        getAppSettings(),
      ]);
      const dismissedIds = new Set(settings.taggingDismissedImageIds ?? []);
      const pendingIds = new Set(settings.taggingPendingImageIds ?? []);
      const visibleImages = images
        .filter((image) => image.isMissing !== true)
        .filter(
          (image) =>
            !dismissedIds.has(image.id) &&
            (getImageManualTagIds(image).length === 0 || pendingIds.has(image.id)),
        )
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

  const visibleQueue = useMemo(() => queue, [queue]);

  const recentTags = useMemo(
    () =>
      recentTagIds
        .map((tagId) => allTags.find((tag) => tag.id === tagId) ?? null)
        .filter((tag): tag is ImageTagRecord => Boolean(tag)),
    [allTags, recentTagIds],
  );

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
      const [nextDetail, tags, settings] = await Promise.all([
        getImageTaggingMeta(detail.image.id),
        listImageTags(),
        getAppSettings(),
      ]);
      setDetail(nextDetail);
      setAllTags(tags);
      setRecentTagIds(settings.imageImportRecentTagIds ?? []);
      await setImageTaggingPending(detail.image.id, true);
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
      await setImageTaggingPending(
        detail.image.id,
        Boolean(nextDetail && getImageManualTagIds(nextDetail.image).length > 0),
      );
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
      const [nextDetail, tags, settings] = await Promise.all([
        getImageTaggingMeta(detail.image.id),
        listImageTags(),
        getAppSettings(),
      ]);
      setDetail(nextDetail);
      setAllTags(tags);
      setRecentTagIds(settings.imageImportRecentTagIds ?? []);
      await setImageTaggingPending(detail.image.id, true);
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
      await dismissImageFromTagging(detail.image.id);
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
    queue: visibleQueue,
    categories,
    allTags,
    selectedImageId,
    detail,
    recentTags,
    selectImage,
    addManualTag,
    removeManualTag,
    createAndAddTag,
    goNext,
    refreshQueue,
  };
}
