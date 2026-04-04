import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '../db/client';
import type {
  ImageRecord,
  ImageTagCategoryRecord,
  ImageTagRecord,
} from '../types/domain';
import {
  addTagsToImages,
  getImageTaggingMeta,
  getOrCreateImageTag,
  listImageTagCategories,
  listImageTags,
  listImagesForTagging,
  removeTagsFromImages,
  type ImageTaggingMeta,
} from '../services/imageService';

function moveTagToRecent(tagId: string, tagIds: string[]) {
  return [tagId, ...tagIds.filter((current) => current !== tagId)].slice(0, 12);
}

async function updateRecentImageTags(tagId: string) {
  const settings = (await db.settings.get('app')) ?? {
    id: 'app' as const,
    schemaVersion: 1,
    pinnedTags: [],
    tagSort: 'popular' as const,
    filterMode: 'AND' as const,
    thumbStore: 'idb' as const,
  };

  await db.settings.put({
    ...settings,
    imageImportRecentTagIds: moveTagToRecent(tagId, settings.imageImportRecentTagIds ?? []),
  });
}

export function useImageTaggingSession() {
  const [queue, setQueue] = useState<ImageRecord[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
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
        listImagesForTagging(),
        listImageTagCategories(),
        listImageTags(),
        db.settings.get('app'),
      ]);

      setQueue(images);
      setCategories(nextCategories);
      setAllTags(tags);
      setRecentTagIds(settings?.imageImportRecentTagIds ?? []);
      setSelectedImageId((prev) => {
        const nextVisible = images.filter((image) => !completedIds.has(image.id));
        if (prev && nextVisible.some((image) => image.id === prev)) return prev;
        return nextVisible[0]?.id ?? null;
      });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'タグ付け対象を読み込めませんでした。');
    } finally {
      setLoading(false);
    }
  }, [completedIds]);

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

  const visibleQueue = useMemo(
    () => queue.filter((image) => !completedIds.has(image.id)),
    [completedIds, queue],
  );

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
        db.settings.get('app'),
      ]);
      setDetail(nextDetail);
      setAllTags(tags);
      setRecentTagIds(settings?.imageImportRecentTagIds ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'タグを追加できませんでした。');
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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'タグを削除できませんでした。');
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
        db.settings.get('app'),
      ]);
      setDetail(nextDetail);
      setAllTags(tags);
      setRecentTagIds(settings?.imageImportRecentTagIds ?? []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : '新しいタグを追加できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const goNext = async () => {
    if (!detail) return;

    const currentId = detail.image.id;
    const nextCompletedIds = new Set(completedIds);
    nextCompletedIds.add(currentId);
    setCompletedIds(nextCompletedIds);

    const [images, tags] = await Promise.all([listImagesForTagging(), listImageTags()]);
    const remaining = images.filter((image) => !nextCompletedIds.has(image.id));
    setQueue(images);
    setAllTags(tags);
    setSelectedImageId(remaining[0]?.id ?? null);
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
