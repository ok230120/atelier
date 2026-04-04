import { db } from '../db/client';
import {
  DEFAULT_IMAGE_TAG_CATEGORY_DEFINITIONS,
  DEFAULT_IMAGE_TAG_CATEGORY_ID,
} from '../types/domain';
import type {
  ImageMount,
  ImageRecord,
  ImageTagCategoryRecord,
  ImageTagRecord,
} from '../types/domain';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp']);

type DirectoryEntry = FileSystemHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
};

export type ScanProgress = {
  done: number;
  total: number;
  added: number;
  skipped: number;
};

export type ImageRescanFailure = {
  mountId: string;
  mountName: string;
  message: string;
};

export type ImageRescanSummary = {
  scannedMountCount: number;
  failedMounts: ImageRescanFailure[];
};

export type ImageQueryFilter = {
  mountId?: string;
  folder?: string;
  tagIds?: string[];
  scope: 'all' | 'current';
  folderDepth?: 'direct' | 'tree';
};

export type RegisterImageFileInput = {
  mountId: string;
  relativePath: string;
  fileHandle: FileSystemFileHandle;
};

export type ImageTaggingMeta = {
  image: ImageRecord;
  mount: ImageMount | null;
  autoTags: ImageTagRecord[];
  manualTags: ImageTagRecord[];
};

function uniqueTagIds(tagIds: string[]) {
  return Array.from(new Set(tagIds.filter(Boolean)));
}

function getFolderPath(relativePath: string) {
  const parts = relativePath.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

function isImageFile(name: string) {
  return IMAGE_EXTENSIONS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

function categorySort(a: ImageTagCategoryRecord, b: ImageTagCategoryRecord) {
  if (a.order !== b.order) return a.order - b.order;
  return a.createdAt - b.createdAt;
}

export function normalizeImageTagName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[ァ-ヴ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/ー/g, '');
}

export function getImageManualTagIds(image: ImageRecord): string[] {
  const autoTagSet = new Set(image.autoTagIds ?? []);
  return (image.tags ?? []).filter((tagId) => !autoTagSet.has(tagId));
}

export function isAutoImageTag(tag: Pick<ImageTagRecord, 'isAuto'>) {
  return tag.isAuto === true;
}

async function ensureImageTagCategories(): Promise<ImageTagCategoryRecord[]> {
  let categories = await db.imageTagCategories.toArray();
  if (categories.length === 0) {
    const now = Date.now();
    const defaults = DEFAULT_IMAGE_TAG_CATEGORY_DEFINITIONS.map((category, index) => ({
      id: category.id,
      name: category.name,
      order: index,
      createdAt: now + index,
      protected: category.protected,
    }));
    await db.imageTagCategories.bulkAdd(defaults);
    categories = defaults;
  }

  const fallbackCategoryExists = categories.some(
    (category) => category.id === DEFAULT_IMAGE_TAG_CATEGORY_ID,
  );
  if (!fallbackCategoryExists) {
    const fallbackDefinition = DEFAULT_IMAGE_TAG_CATEGORY_DEFINITIONS.find(
      (category) => category.id === DEFAULT_IMAGE_TAG_CATEGORY_ID,
    );
    if (fallbackDefinition) {
      const nextFallback: ImageTagCategoryRecord = {
        id: fallbackDefinition.id,
        name: fallbackDefinition.name,
        order:
          categories.length === 0
            ? 0
            : Math.max(...categories.map((category) => category.order)) + 1,
        createdAt: Date.now(),
        protected: true,
      };
      await db.imageTagCategories.add(nextFallback);
      categories = [...categories, nextFallback];
    }
  }

  return [...categories].sort(categorySort);
}

async function getFallbackImageTagCategoryId() {
  const categories = await ensureImageTagCategories();
  return categories.find((category) => category.protected)?.id ?? DEFAULT_IMAGE_TAG_CATEGORY_ID;
}

async function collectImageFiles(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  recursive: boolean,
): Promise<Array<{ relativePath: string; fileHandle: FileSystemFileHandle }>> {
  const entries: Array<{ relativePath: string; fileHandle: FileSystemFileHandle }> = [];
  const iterable = (dirHandle as DirectoryEntry).values?.();
  if (!iterable) return entries;

  for await (const entry of iterable) {
    if (entry.kind === 'file' && isImageFile(entry.name)) {
      entries.push({
        relativePath: prefix ? `${prefix}/${entry.name}` : entry.name,
        fileHandle: entry as FileSystemFileHandle,
      });
      continue;
    }

    if (entry.kind === 'directory' && recursive) {
      const nested = await collectImageFiles(
        entry as FileSystemDirectoryHandle,
        prefix ? `${prefix}/${entry.name}` : entry.name,
        recursive,
      );
      entries.push(...nested);
    }
  }

  return entries;
}

export async function listImageTagCategories(): Promise<ImageTagCategoryRecord[]> {
  return ensureImageTagCategories();
}

export async function createImageTagCategory(name: string): Promise<ImageTagCategoryRecord> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('カテゴリ名を入力してください。');

  const categories = await ensureImageTagCategories();
  if (categories.some((category) => category.name === trimmed)) {
    throw new Error('同じ名前のカテゴリがすでにあります。');
  }

  const nextCategory: ImageTagCategoryRecord = {
    id: crypto.randomUUID(),
    name: trimmed,
    order:
      categories.length === 0 ? 0 : Math.max(...categories.map((category) => category.order)) + 1,
    createdAt: Date.now(),
    protected: false,
  };

  await db.imageTagCategories.add(nextCategory);
  return nextCategory;
}

export async function renameImageTagCategory(categoryId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('カテゴリ名を入力してください。');

  const categories = await ensureImageTagCategories();
  if (categories.some((category) => category.id !== categoryId && category.name === trimmed)) {
    throw new Error('同じ名前のカテゴリがすでにあります。');
  }

  await db.imageTagCategories.update(categoryId, { name: trimmed });
}

export async function reorderImageTagCategories(categoryIds: string[]): Promise<void> {
  for (let index = 0; index < categoryIds.length; index += 1) {
    await db.imageTagCategories.update(categoryIds[index], { order: index });
  }
}

export async function deleteImageTagCategory(categoryId: string): Promise<void> {
  const categories = await ensureImageTagCategories();
  const category = categories.find((item) => item.id === categoryId);
  if (!category) return;
  if (category.protected) throw new Error('このカテゴリは削除できません。');

  const fallbackCategoryId = await getFallbackImageTagCategoryId();
  await db.transaction('rw', db.imageTags, db.imageTagCategories, async () => {
    const tags = await db.imageTags.where('categoryId').equals(categoryId).toArray();
    for (const tag of tags) {
      await db.imageTags.update(tag.id, { categoryId: fallbackCategoryId });
    }
    await db.imageTagCategories.delete(categoryId);
  });

  const remaining = (await db.imageTagCategories.toArray()).sort(categorySort);
  for (let index = 0; index < remaining.length; index += 1) {
    await db.imageTagCategories.update(remaining[index].id, { order: index });
  }
}

export async function listImageTags(): Promise<ImageTagRecord[]> {
  await ensureImageTagCategories();
  return db.imageTags.orderBy('usageCount').reverse().toArray();
}

export async function listManualImageTags(): Promise<ImageTagRecord[]> {
  const tags = await listImageTags();
  return tags.filter((tag) => !tag.isAuto);
}

export async function refreshImageTagUsageCounts(tagIds?: string[]): Promise<void> {
  const tags = tagIds?.length
    ? (await db.imageTags.bulkGet(uniqueTagIds(tagIds))).filter(
        (tag): tag is ImageTagRecord => Boolean(tag),
      )
    : await db.imageTags.toArray();

  if (tags.length === 0) return;

  const updates = await Promise.all(
    tags.map(async (tag) => {
      const usageCount = await db.images
        .where('tags')
        .equals(tag.id)
        .filter((image) => image.isMissing !== true)
        .count();
      return { tagId: tag.id, usageCount };
    }),
  );

  for (const update of updates) {
    await db.imageTags.update(update.tagId, { usageCount: update.usageCount });
  }
}

async function getOrCreateFolderAutoTagIds(folderPath: string): Promise<string[]> {
  const fallbackCategoryId = await getFallbackImageTagCategoryId();
  const tagIds: string[] = [];

  for (const tagName of deriveFolderAutoTagNames(folderPath)) {
    const tag = await getOrCreateImageTag(tagName, fallbackCategoryId, { isAuto: true });
    tagIds.push(tag.id);
  }

  return uniqueTagIds(tagIds);
}

export async function getOrCreateImageTag(
  name: string,
  categoryId: string,
  options?: { isAuto?: boolean },
): Promise<ImageTagRecord> {
  await ensureImageTagCategories();

  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('タグ名を入力してください。');

  const normalizedName = normalizeImageTagName(trimmedName);
  const existing = await db.imageTags.where('normalizedName').equals(normalizedName).first();
  if (existing) {
    if (options?.isAuto && !existing.isAuto) {
      // Keep the existing category when a manual tag later becomes
      // reused as a folder-derived auto tag.
      const nextTag = { ...existing, isAuto: true };
      await db.imageTags.put(nextTag);
      return nextTag;
    }
    return existing;
  }

  const fallbackCategoryId = await getFallbackImageTagCategoryId();
  const tag: ImageTagRecord = {
    id: crypto.randomUUID(),
    name: trimmedName,
    normalizedName,
    categoryId: categoryId || fallbackCategoryId,
    isAuto: options?.isAuto === true,
    createdAt: Date.now(),
    usageCount: 0,
  };

  await db.imageTags.add(tag);
  return tag;
}

export async function renameImageTag(tagId: string, nextName: string): Promise<void> {
  const tag = await db.imageTags.get(tagId);
  if (!tag) return;
  if (tag.isAuto) throw new Error('自動タグは名前を変更できません。');

  const trimmedName = nextName.trim();
  if (!trimmedName) throw new Error('タグ名を入力してください。');

  const normalizedName = normalizeImageTagName(trimmedName);
  const existing = await db.imageTags.where('normalizedName').equals(normalizedName).first();
  if (existing && existing.id !== tagId) {
    throw new Error('同じ名前のタグがすでにあります。');
  }

  await db.imageTags.update(tagId, {
    name: trimmedName,
    normalizedName,
  });
}

export async function moveImageTagToCategory(tagId: string, categoryId: string): Promise<void> {
  const tag = await db.imageTags.get(tagId);
  if (!tag) return;
  await db.imageTags.update(tagId, { categoryId });
}

export async function mergeImageTags(sourceTagId: string, targetTagId: string): Promise<void> {
  if (sourceTagId === targetTagId) return;

  const [sourceTag, targetTag] = await Promise.all([
    db.imageTags.get(sourceTagId),
    db.imageTags.get(targetTagId),
  ]);

  if (!sourceTag || !targetTag) return;
  if (sourceTag.isAuto || targetTag.isAuto) {
    throw new Error('自動タグはマージできません。');
  }

  const images = await db.images.where('tags').equals(sourceTagId).toArray();
  for (const image of images) {
    await db.images.update(image.id, {
      tags: uniqueTagIds(image.tags.map((tagId) => (tagId === sourceTagId ? targetTagId : tagId))),
      updatedAt: Date.now(),
    });
  }

  await db.imageTags.delete(sourceTagId);
  await refreshImageTagUsageCounts([sourceTagId, targetTagId]);
}

export async function deleteImageTag(tagId: string): Promise<void> {
  const tag = await db.imageTags.get(tagId);
  if (!tag) return;
  if (tag.isAuto) throw new Error('自動タグは削除できません。');

  const images = await db.images.where('tags').equals(tagId).toArray();
  for (const image of images) {
    await db.images.update(image.id, {
      tags: image.tags.filter((currentTagId) => currentTagId !== tagId),
      autoTagIds: (image.autoTagIds ?? []).filter((currentTagId) => currentTagId !== tagId),
      updatedAt: Date.now(),
    });
  }

  await db.imageTags.delete(tagId);
  await refreshImageTagUsageCounts([tagId]);
}

async function upsertImageRecordForHandle({
  mountId,
  relativePath,
  fileHandle,
}: RegisterImageFileInput): Promise<ImageRecord> {
  const existing = await db.images
    .where('[mountId+relativePath]')
    .equals([mountId, relativePath])
    .first();
  const file = await fileHandle.getFile();
  const folderPath = getFolderPath(relativePath);
  const autoTagIds = await getOrCreateFolderAutoTagIds(folderPath);
  const thumbnail = await generateThumbnail(file);
  const now = Date.now();

  const affectedTagIds = new Set<string>(autoTagIds);
  let nextRecord: ImageRecord;

  if (existing) {
    existing.tags.forEach((tagId) => affectedTagIds.add(tagId));
    const manualTagIds = getImageManualTagIds(existing);
    const nextTags = uniqueTagIds([...manualTagIds, ...autoTagIds]);
    nextTags.forEach((tagId) => affectedTagIds.add(tagId));

    nextRecord = {
      ...existing,
      fileName: file.name,
      folderPath,
      fileHandle,
      thumbnail,
      tags: nextTags,
      autoTagIds,
      updatedAt: now,
      lastSeenAt: now,
      isMissing: false,
    };

    await db.images.put(nextRecord);
  } else {
    nextRecord = {
      id: crypto.randomUUID(),
      fileName: file.name,
      relativePath,
      folderPath,
      mountId,
      fileHandle,
      thumbnail,
      tags: autoTagIds,
      autoTagIds,
      favorite: false,
      addedAt: now,
      updatedAt: now,
      lastSeenAt: now,
      isMissing: false,
    };

    await db.images.add(nextRecord);
  }

  await refreshImageTagUsageCounts(Array.from(affectedTagIds));
  return nextRecord;
}

export function deriveFolderAutoTagNames(folderPath: string): string[] {
  if (!folderPath) return [];
  return folderPath
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function generateThumbnail(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(size / image.width, size / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/webp', 0.82));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image.'));
    };

    image.src = objectUrl;
  });
}

export async function scanImageMount(
  mountId: string,
  dirHandle: FileSystemDirectoryHandle,
  onProgress?: (progress: ScanProgress) => void,
): Promise<ScanProgress> {
  const permission = await dirHandle.queryPermission({ mode: 'read' });
  if (permission !== 'granted') {
    const granted = await dirHandle.requestPermission({ mode: 'read' });
    if (granted !== 'granted') {
      throw new Error('Folder access permission denied.');
    }
  }

  const mount = await db.imageMounts.get(mountId);
  const includeSubdirs = mount?.includeSubdirs ?? true;
  const files = await collectImageFiles(dirHandle, '', includeSubdirs);
  const seenRelativePaths = new Set<string>();

  let added = 0;
  let skipped = 0;

  for (let index = 0; index < files.length; index += 1) {
    const { relativePath, fileHandle } = files[index];
    seenRelativePaths.add(relativePath);

    try {
      const existing = await db.images
        .where('[mountId+relativePath]')
        .equals([mountId, relativePath])
        .first();

      await upsertImageRecordForHandle({ mountId, relativePath, fileHandle });
      if (existing) skipped += 1;
      else added += 1;
    } catch {
      skipped += 1;
    }

    onProgress?.({ done: index + 1, total: files.length, added, skipped });
  }

  const mountImages = await db.images.where('mountId').equals(mountId).toArray();
  const missingIds: string[] = [];
  const affectedTagIds = new Set<string>();

  for (const image of mountImages) {
    if (seenRelativePaths.has(image.relativePath) || image.isMissing) continue;
    image.tags.forEach((tagId) => affectedTagIds.add(tagId));
    missingIds.push(image.id);
  }

  if (missingIds.length > 0) {
    await db.transaction('rw', db.images, async () => {
      for (const imageId of missingIds) {
        await db.images.update(imageId, {
          isMissing: true,
          updatedAt: Date.now(),
        });
      }
    });
    await refreshImageTagUsageCounts(Array.from(affectedTagIds));
  }

  const imageCount = await db.images
    .where('mountId')
    .equals(mountId)
    .filter((image) => image.isMissing !== true)
    .count();

  await db.imageMounts.update(mountId, {
    imageCount,
    lastScannedAt: Date.now(),
  });

  return { done: files.length, total: files.length, added, skipped };
}

export async function rescanAllImageMounts(): Promise<ImageRescanSummary> {
  const mounts = await listImageMounts();
  const failedMounts: ImageRescanFailure[] = [];
  let scannedMountCount = 0;

  for (const mount of mounts) {
    if (!mount.dirHandle) {
      failedMounts.push({
        mountId: mount.id,
        mountName: mount.name,
        message: 'Folder handle is unavailable.',
      });
      continue;
    }

    try {
      await scanImageMount(mount.id, mount.dirHandle);
      scannedMountCount += 1;
    } catch (error) {
      failedMounts.push({
        mountId: mount.id,
        mountName: mount.name,
        message: error instanceof Error ? error.message : 'Failed to rescan mount.',
      });
    }
  }

  return {
    scannedMountCount,
    failedMounts,
  };
}

export async function registerImageFileInMount(input: RegisterImageFileInput): Promise<ImageRecord> {
  const record = await upsertImageRecordForHandle(input);
  const imageCount = await db.images
    .where('mountId')
    .equals(input.mountId)
    .filter((image) => image.isMissing !== true)
    .count();

  await db.imageMounts.update(input.mountId, {
    imageCount,
    lastScannedAt: Date.now(),
  });

  return record;
}

export async function removeImportedImageRecord(imageId: string): Promise<void> {
  const image = await db.images.get(imageId);
  if (!image) return;

  const affectedTagIds = uniqueTagIds(image.tags ?? []);
  await db.images.delete(imageId);

  const imageCount = await db.images
    .where('mountId')
    .equals(image.mountId)
    .filter((current) => current.isMissing !== true)
    .count();

  await db.imageMounts.update(image.mountId, {
    imageCount,
    lastScannedAt: Date.now(),
  });

  await refreshImageTagUsageCounts(affectedTagIds);
}

export async function getImageFileUrl(image: ImageRecord): Promise<string | null> {
  if (!image.fileHandle) return null;

  try {
    const permission = await image.fileHandle.queryPermission({ mode: 'read' });
    if (permission !== 'granted') {
      const granted = await image.fileHandle.requestPermission({ mode: 'read' });
      if (granted !== 'granted') return null;
    }

    const file = await image.fileHandle.getFile();
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

export async function addTagsToImages(imageIds: string[], tagIds: string[]): Promise<void> {
  if (imageIds.length === 0 || tagIds.length === 0) return;

  await db.transaction('rw', db.images, async () => {
    for (const imageId of imageIds) {
      const image = await db.images.get(imageId);
      if (!image) continue;

      await db.images.update(imageId, {
        tags: uniqueTagIds([...image.tags, ...tagIds]),
        updatedAt: Date.now(),
      });
    }
  });

  await refreshImageTagUsageCounts(tagIds);
}

export async function removeTagsFromImages(imageIds: string[], tagIds: string[]): Promise<void> {
  if (imageIds.length === 0 || tagIds.length === 0) return;

  await db.transaction('rw', db.images, async () => {
    for (const imageId of imageIds) {
      const image = await db.images.get(imageId);
      if (!image) continue;

      const autoTagSet = new Set(image.autoTagIds ?? []);
      const removableTagIds = tagIds.filter((tagId) => !autoTagSet.has(tagId));
      if (removableTagIds.length === 0) continue;

      await db.images.update(imageId, {
        tags: image.tags.filter((tagId) => !removableTagIds.includes(tagId)),
        updatedAt: Date.now(),
      });
    }
  });

  await refreshImageTagUsageCounts(tagIds);
}

export async function getSubfolders(mountId: string | null, parentFolder: string): Promise<string[]> {
  const images = (mountId
    ? await db.images.where('mountId').equals(mountId).toArray()
    : await db.images.toArray()).filter((image) => image.isMissing !== true);

  const folders = new Set<string>();

  for (const image of images) {
    if (!image.folderPath) continue;

    if (parentFolder) {
      if (!image.folderPath.startsWith(`${parentFolder}/`)) continue;
      const child = image.folderPath.slice(parentFolder.length + 1).split('/')[0];
      if (child) folders.add(child);
      continue;
    }

    const topLevel = image.folderPath.split('/')[0];
    if (topLevel) folders.add(topLevel);
  }

  return Array.from(folders).sort((a, b) => a.localeCompare(b, 'ja'));
}

export async function queryImages(filter: ImageQueryFilter): Promise<ImageRecord[]> {
  let images = (await db.images.toArray())
    .filter((image) => image.isMissing !== true)
    .sort((a, b) => b.addedAt - a.addedAt);

  if (filter.scope === 'current') {
    if (filter.mountId) {
      images = images.filter((image) => image.mountId === filter.mountId);
    }

    const folderDepth = filter.folderDepth ?? 'direct';

    if (filter.folder) {
      images = images.filter((image) =>
        folderDepth === 'tree'
          ? image.folderPath === filter.folder || image.folderPath.startsWith(`${filter.folder}/`)
          : image.folderPath === filter.folder,
      );
    } else if (filter.mountId && folderDepth === 'direct') {
      images = images.filter((image) => image.folderPath === '');
    }
  }

  if ((filter.tagIds ?? []).length > 0) {
    const tagIds = filter.tagIds ?? [];
    images = images.filter((image) => tagIds.every((tagId) => image.tags.includes(tagId)));
  }

  return images;
}

export async function getBulkRemovableTags(imageIds: string[]): Promise<ImageTagRecord[]> {
  if (imageIds.length === 0) return [];

  const tagIds = new Set<string>();
  const images = await db.images.bulkGet(imageIds);
  for (const image of images) {
    if (!image) continue;
    const autoTagSet = new Set(image.autoTagIds ?? []);
    for (const tagId of image.tags) {
      if (!autoTagSet.has(tagId)) tagIds.add(tagId);
    }
  }

  const tags = await db.imageTags.bulkGet(Array.from(tagIds));
  return tags
    .filter((tag): tag is ImageTagRecord => Boolean(tag))
    .sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name, 'ja'));
}

export async function listImageMounts(): Promise<ImageMount[]> {
  return db.imageMounts.orderBy('addedAt').reverse().toArray();
}

export async function listImagesForTagging(): Promise<ImageRecord[]> {
  const images = await db.images.toArray();
  return images
    .filter((image) => image.isMissing !== true)
    .filter((image) => getImageManualTagIds(image).length === 0)
    .sort((a, b) => b.addedAt - a.addedAt);
}

export async function getImageTaggingMeta(imageId: string): Promise<ImageTaggingMeta | null> {
  const image = await db.images.get(imageId);
  if (!image) return null;

  const tagIds = uniqueTagIds([...(image.tags ?? []), ...(image.autoTagIds ?? [])]);
  const [mount, tags] = await Promise.all([
    db.imageMounts.get(image.mountId),
    db.imageTags.bulkGet(tagIds),
  ]);

  const tagMap = new Map(
    tags.filter((tag): tag is ImageTagRecord => Boolean(tag)).map((tag) => [tag.id, tag]),
  );
  const autoTags = (image.autoTagIds ?? [])
    .map((tagId) => tagMap.get(tagId) ?? null)
    .filter((tag): tag is ImageTagRecord => Boolean(tag));
  const manualTags = getImageManualTagIds(image)
    .map((tagId) => tagMap.get(tagId) ?? null)
    .filter((tag): tag is ImageTagRecord => Boolean(tag));

  return {
    image,
    mount: mount ?? null,
    autoTags,
    manualTags,
  };
}
