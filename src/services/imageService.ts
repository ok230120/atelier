import { db } from '../db/client';
import {
  DEFAULT_IMAGE_TAG_CATEGORY_DEFINITIONS,
  DEFAULT_IMAGE_TAG_CATEGORY_ID,
  type AppSettings,
  type ImageMount,
  type ImageRecord,
  type ImageTaggingCompletedHistoryEntry,
  type ImageTagCategoryRecord,
  type ImageTagRecord,
  type LegacyImageImportResult,
} from '../types/domain';
import {
  addTagsToImagesDesktop,
  createImageMountDesktop,
  createImageTagCategoryDesktop,
  createImageTagDesktop,
  createSubdirectoryDesktop,
  deleteImageTagCategoryDesktop,
  deleteImageTagDesktop,
  ensureThumbnailDesktop,
  getImageAppSettingsDesktop,
  getImageDetailDesktop,
  getImageFileDataUrlDesktop,
  importLegacyImageDataDesktop,
  listChildDirectoriesDesktop,
  listImageMountsDesktop,
  listImagesDesktop,
  listImageTagCategoriesDesktop,
  listImageTagsDesktop,
  listMissingImagesDesktop,
  mergeImageTagsDesktop,
  moveImageTagCategoryDesktop,
  pickImageMountPath,
  relinkImageMountDesktop,
  removeImageMountDesktop,
  removeMissingImagesDesktop,
  removeTagsFromImagesDesktop,
  renameImageTagCategoryDesktop,
  renameImageTagDesktop,
  reorderImageTagCategoriesDesktop,
  scanImageMountDesktop,
  setImageAppSettingsDesktop,
  toggleImageFavoriteDesktop,
  type DesktopImageAppSettings,
  type DesktopImageTaggingMeta,
} from './imageDesktopApi';
import fileSystem from './fileSystem';
import { isTauriRuntime } from './tauri';

type BrowserImageTaggingMeta = {
  image: ImageRecord;
  mount: ImageMount | null;
  autoTags: ImageTagRecord[];
  manualTags: ImageTagRecord[];
};

type RegisterImageFileInput = {
  mountId: string;
  relativePath: string;
  fileHandle: FileSystemFileHandle;
};

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

export type ImageTaggingMeta = DesktopImageTaggingMeta | BrowserImageTaggingMeta;

export type ImageStorageInfo = {
  mode: 'tauri-sqlite';
  databaseLabel: string;
  cacheLabel: string;
};

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp']);

const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app',
  schemaVersion: 1,
  pinnedTags: [],
  tagSort: 'popular',
  filterMode: 'AND',
  thumbStore: 'idb',
  taggingCompletedHistory: [],
};

let pendingBrowserMountHandle: FileSystemDirectoryHandle | null = null;

function fromDesktopSettings(settings: DesktopImageAppSettings): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    imageImportRecentFolders: settings.imageImportRecentFolders,
    imageImportRecentTagIds: settings.imageImportRecentTagIds,
    taggingCompletedHistory: settings.taggingCompletedHistory ?? [],
    imageTagReadingsBackfillDoneAt: settings.imageTagReadingsBackfillDoneAt,
  };
}

function toDesktopSettings(settings: AppSettings): DesktopImageAppSettings {
  return {
    imageImportRecentFolders: settings.imageImportRecentFolders ?? [],
    imageImportRecentTagIds: settings.imageImportRecentTagIds ?? [],
    taggingCompletedHistory: settings.taggingCompletedHistory ?? [],
    imageTagReadingsBackfillDoneAt: settings.imageTagReadingsBackfillDoneAt,
  };
}

function getDefaultBrowserSettings(): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    imageImportRecentFolders: [],
    imageImportRecentTagIds: [],
    taggingCompletedHistory: [],
  };
}

function normalizeCompletedHistory(
  history: ImageTaggingCompletedHistoryEntry[],
): ImageTaggingCompletedHistoryEntry[] {
  const latestByImageId = new Map<string, ImageTaggingCompletedHistoryEntry>();

  for (const entry of history) {
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

export function getNormalizedImageTaggingCompletedHistory(
  settings: Pick<AppSettings, 'taggingCompletedHistory'>,
): ImageTaggingCompletedHistoryEntry[] {
  return normalizeCompletedHistory(settings.taggingCompletedHistory ?? []);
}

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
  return name.trim().toLowerCase().normalize('NFKC');
}

export function matchesImageTagSearch(
  tag: Pick<ImageTagRecord, 'name' | 'normalizedName' | 'searchReadings'>,
  query: string,
  normalizedQuery?: string,
) {
  const trimmedQuery = query.trim().toLowerCase();
  const normalized = normalizedQuery ?? normalizeImageTagName(query);
  if (!trimmedQuery && !normalized) return true;

  return (
    tag.name.toLowerCase().includes(trimmedQuery) ||
    tag.normalizedName.includes(normalized) ||
    (tag.searchReadings ?? []).some((reading) => reading.includes(normalized))
  );
}

export function sortImageTagsByUsage<T extends Pick<ImageTagRecord, 'usageCount' | 'name'>>(tags: T[]) {
  return [...tags].sort((a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name, 'ja'));
}

export function getImageManualTagIds(image: ImageRecord): string[] {
  const autoTagSet = new Set(image.autoTagIds ?? []);
  return (image.tags ?? []).filter((tagId) => !autoTagSet.has(tagId));
}

export function isAutoImageTag(tag: Pick<ImageTagRecord, 'isAuto'>) {
  return tag.isAuto === true;
}

async function ensureBrowserImageTagCategories(): Promise<ImageTagCategoryRecord[]> {
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

  const fallbackExists = categories.some((category) => category.id === DEFAULT_IMAGE_TAG_CATEGORY_ID);
  if (!fallbackExists) {
    const fallback = DEFAULT_IMAGE_TAG_CATEGORY_DEFINITIONS.find(
      (category) => category.id === DEFAULT_IMAGE_TAG_CATEGORY_ID,
    );
    if (fallback) {
      const nextFallback: ImageTagCategoryRecord = {
        id: fallback.id,
        name: fallback.name,
        order: categories.length === 0 ? 0 : Math.max(...categories.map((category) => category.order)) + 1,
        createdAt: Date.now(),
        protected: true,
      };
      await db.imageTagCategories.add(nextFallback);
      categories = [...categories, nextFallback];
    }
  }

  return [...categories].sort(categorySort);
}

async function getFallbackBrowserImageTagCategoryId() {
  const categories = await ensureBrowserImageTagCategories();
  return categories.find((category) => category.protected)?.id ?? DEFAULT_IMAGE_TAG_CATEGORY_ID;
}

async function findExistingBrowserMountForHandle(handle: FileSystemDirectoryHandle): Promise<ImageMount | null> {
  const mounts = await db.imageMounts.toArray();
  for (const mount of mounts) {
    const isSameEntry = (mount.dirHandle as FileSystemDirectoryHandle | undefined)?.isSameEntry;
    if (typeof isSameEntry !== 'function') continue;
    try {
      if (await isSameEntry.call(mount.dirHandle, handle)) return mount;
    } catch {
      // Ignore stale handles.
    }
  }
  return null;
}

async function getBrowserMountById(mountId: string): Promise<ImageMount> {
  const mount = await db.imageMounts.get(mountId);
  if (!mount?.dirHandle) {
    throw new Error('保存先フォルダを開けませんでした。');
  }
  return mount;
}

async function refreshImageCountForMount(mountId: string) {
  const imageCount = await db.images
    .where('mountId')
    .equals(mountId)
    .filter((image) => image.isMissing !== true)
    .count();

  await db.imageMounts.update(mountId, {
    imageCount,
    lastScannedAt: Date.now(),
  });
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
      reject(new Error('画像の読み込みに失敗しました。'));
    };

    image.src = objectUrl;
  });
}

export async function refreshImageTagUsageCounts(tagIds?: string[]): Promise<void> {
  if (isTauriRuntime()) return;

  const tags = tagIds?.length
    ? (await db.imageTags.bulkGet(uniqueTagIds(tagIds))).filter(
        (tag): tag is ImageTagRecord => Boolean(tag),
      )
    : await db.imageTags.toArray();

  if (tags.length === 0) return;

  for (const tag of tags) {
    const usageCount = await db.images
      .where('tags')
      .equals(tag.id)
      .filter((image) => image.isMissing !== true)
      .count();
    await db.imageTags.update(tag.id, { usageCount });
  }
}

async function getOrCreateFolderAutoTagIds(folderPath: string): Promise<string[]> {
  const fallbackCategoryId = await getFallbackBrowserImageTagCategoryId();
  const tagIds: string[] = [];

  for (const tagName of deriveFolderAutoTagNames(folderPath)) {
    const tag = await getOrCreateImageTag(tagName, fallbackCategoryId, { isAuto: true });
    tagIds.push(tag.id);
  }

  return uniqueTagIds(tagIds);
}

async function upsertBrowserImageRecord({
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

export async function getImageAppSettings(): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    return (await db.settings.get('app')) ?? getDefaultBrowserSettings();
  }
  return fromDesktopSettings(await getImageAppSettingsDesktop());
}

export async function setImageAppSettings(settings: AppSettings): Promise<AppSettings> {
  if (!isTauriRuntime()) {
    const nextSettings: AppSettings = {
      ...settings,
      id: 'app',
      imageImportRecentFolders: settings.imageImportRecentFolders ?? [],
      imageImportRecentTagIds: settings.imageImportRecentTagIds ?? [],
      taggingCompletedHistory: normalizeCompletedHistory(settings.taggingCompletedHistory ?? []),
    };
    await db.settings.put(nextSettings);
    return nextSettings;
  }
  const nextSettings = await setImageAppSettingsDesktop(toDesktopSettings(settings));
  return fromDesktopSettings(nextSettings);
}

export async function backfillImageTagReadings(): Promise<void> {
  if (!isTauriRuntime()) return;
  const settings = await getImageAppSettings();
  if (settings.imageTagReadingsBackfillDoneAt) return;
  await setImageAppSettings({
    ...settings,
    imageTagReadingsBackfillDoneAt: Date.now(),
  });
}

export async function listImageMounts(): Promise<ImageMount[]> {
  if (!isTauriRuntime()) {
    return db.imageMounts.orderBy('addedAt').reverse().toArray();
  }
  return listImageMountsDesktop();
}

export async function pickImageMount(): Promise<string | null> {
  if (!isTauriRuntime()) {
    const handle = await fileSystem.pickDirectory();
    if (!handle) return null;
    pendingBrowserMountHandle = handle;
    return handle.name;
  }
  return pickImageMountPath();
}

export async function createImageMount(basePath: string, includeSubdirs = true): Promise<ImageMount> {
  if (!isTauriRuntime()) {
    const handle = pendingBrowserMountHandle;
    pendingBrowserMountHandle = null;

    if (!handle) {
      throw new Error('フォルダ選択からやり直してください。');
    }

    const hasPermission = await fileSystem.verifyPermission(handle, 'readwrite');
    if (!hasPermission) {
      throw new Error('保存先フォルダへの書き込み権限を取得できませんでした。');
    }

    const existing = await findExistingBrowserMountForHandle(handle);
    if (existing) {
      const nextMount = { ...existing, dirHandle: handle, includeSubdirs };
      await db.imageMounts.put(nextMount);
      return nextMount;
    }

    const mount: ImageMount = {
      id: crypto.randomUUID(),
      name: basePath || handle.name,
      dirHandle: handle,
      includeSubdirs,
      addedAt: Date.now(),
      imageCount: 0,
      isAvailable: true,
    };
    await db.imageMounts.put(mount);
    return mount;
  }
  return createImageMountDesktop(basePath, includeSubdirs);
}

export async function removeImageMount(mountId: string): Promise<void> {
  if (!isTauriRuntime()) {
    await db.transaction('rw', db.imageMounts, db.images, async () => {
      await db.imageMounts.delete(mountId);
      const images = await db.images.where('mountId').equals(mountId).toArray();
      await db.images.bulkDelete(images.map((image) => image.id));
    });
    return;
  }
  await removeImageMountDesktop(mountId);
}

export async function relinkImageMount(mountId: string, basePath: string): Promise<ImageMount> {
  if (!isTauriRuntime()) {
    const handle = pendingBrowserMountHandle;
    pendingBrowserMountHandle = null;
    if (!handle) {
      throw new Error('フォルダ選択からやり直してください。');
    }
    const mount = await db.imageMounts.get(mountId);
    if (!mount) throw new Error('フォルダが見つかりません。');
    const nextMount = { ...mount, name: basePath || handle.name, dirHandle: handle };
    await db.imageMounts.put(nextMount);
    return nextMount;
  }
  return relinkImageMountDesktop(mountId, basePath);
}

export async function scanImageMount(mountId: string): Promise<ScanProgress> {
  if (!isTauriRuntime()) {
    const mount = await getBrowserMountById(mountId);
    const hasPermission = await fileSystem.verifyPermission(mount.dirHandle!, 'read');
    if (!hasPermission) {
      throw new Error('フォルダへの読み取り権限を取得できませんでした。');
    }

    const files = await collectImageFiles(mount.dirHandle!, '', mount.includeSubdirs);
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
        await upsertBrowserImageRecord({ mountId, relativePath, fileHandle });
        if (existing) skipped += 1;
        else added += 1;
      } catch {
        skipped += 1;
      }
    }

    const mountImages = await db.images.where('mountId').equals(mountId).toArray();
    const missingIds = mountImages
      .filter((image) => !seenRelativePaths.has(image.relativePath) && image.isMissing !== true)
      .map((image) => image.id);

    if (missingIds.length > 0) {
      for (const imageId of missingIds) {
        await db.images.update(imageId, {
          isMissing: true,
          updatedAt: Date.now(),
        });
      }
    }

    await refreshImageCountForMount(mountId);
    return { done: files.length, total: files.length, added, skipped };
  }
  return scanImageMountDesktop(mountId);
}

export async function listImageTagCategories(): Promise<ImageTagCategoryRecord[]> {
  if (!isTauriRuntime()) {
    return ensureBrowserImageTagCategories();
  }
  return listImageTagCategoriesDesktop();
}

export async function createImageTagCategory(name: string): Promise<ImageTagCategoryRecord> {
  if (!isTauriRuntime()) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('カテゴリ名を入力してください。');
    const categories = await ensureBrowserImageTagCategories();
    if (categories.some((category) => category.name === trimmed)) {
      throw new Error('同じ名前のカテゴリがすでにあります。');
    }
    const nextCategory: ImageTagCategoryRecord = {
      id: crypto.randomUUID(),
      name: trimmed,
      order: categories.length === 0 ? 0 : Math.max(...categories.map((category) => category.order)) + 1,
      createdAt: Date.now(),
      protected: false,
    };
    await db.imageTagCategories.add(nextCategory);
    return nextCategory;
  }
  return createImageTagCategoryDesktop(name);
}

export async function renameImageTagCategory(categoryId: string, name: string): Promise<void> {
  if (!isTauriRuntime()) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('カテゴリ名を入力してください。');
    const categories = await ensureBrowserImageTagCategories();
    if (categories.some((category) => category.id !== categoryId && category.name === trimmed)) {
      throw new Error('同じ名前のカテゴリがすでにあります。');
    }
    await db.imageTagCategories.update(categoryId, { name: trimmed });
    return;
  }
  await renameImageTagCategoryDesktop(categoryId, name);
}

export async function reorderImageTagCategories(categoryIds: string[]): Promise<void> {
  if (!isTauriRuntime()) {
    for (let index = 0; index < categoryIds.length; index += 1) {
      await db.imageTagCategories.update(categoryIds[index], { order: index });
    }
    return;
  }
  await reorderImageTagCategoriesDesktop(categoryIds);
}

export async function deleteImageTagCategory(categoryId: string): Promise<void> {
  if (!isTauriRuntime()) {
    const categories = await ensureBrowserImageTagCategories();
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    if (category.protected) throw new Error('このカテゴリは削除できません。');

    const fallbackCategoryId = await getFallbackBrowserImageTagCategoryId();
    await db.transaction('rw', db.imageTags, db.imageTagCategories, async () => {
      const tags = await db.imageTags.where('categoryId').equals(categoryId).toArray();
      for (const tag of tags) {
        await db.imageTags.update(tag.id, { categoryId: fallbackCategoryId });
      }
      await db.imageTagCategories.delete(categoryId);
    });
    return;
  }
  await deleteImageTagCategoryDesktop(categoryId);
}

export async function listImageTags(): Promise<ImageTagRecord[]> {
  if (!isTauriRuntime()) {
    await ensureBrowserImageTagCategories();
    return db.imageTags.orderBy('usageCount').reverse().toArray();
  }
  return listImageTagsDesktop();
}

export async function getOrCreateImageTag(
  name: string,
  categoryId: string,
  options?: { isAuto?: boolean },
): Promise<ImageTagRecord> {
  if (!isTauriRuntime()) {
    await ensureBrowserImageTagCategories();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('タグ名を入力してください。');

    const normalizedName = normalizeImageTagName(trimmed);
    const existing = await db.imageTags.where('normalizedName').equals(normalizedName).first();
    if (existing) {
      if (options?.isAuto && !existing.isAuto) {
        const nextTag = { ...existing, isAuto: true };
        await db.imageTags.put(nextTag);
        return nextTag;
      }
      return existing;
    }

    const fallbackCategoryId = await getFallbackBrowserImageTagCategoryId();
    const tag: ImageTagRecord = {
      id: crypto.randomUUID(),
      name: trimmed,
      normalizedName,
      searchReadings: [],
      categoryId: categoryId || fallbackCategoryId,
      isAuto: options?.isAuto === true,
      createdAt: Date.now(),
      usageCount: 0,
    };
    await db.imageTags.add(tag);
    return tag;
  }
  return createImageTagDesktop(name, categoryId);
}

export async function renameImageTag(tagId: string, name: string): Promise<void> {
  if (!isTauriRuntime()) {
    const tag = await db.imageTags.get(tagId);
    if (!tag) return;
    if (tag.isAuto) throw new Error('自動タグは名前を変更できません。');

    const trimmed = name.trim();
    if (!trimmed) throw new Error('タグ名を入力してください。');

    const normalizedName = normalizeImageTagName(trimmed);
    const existing = await db.imageTags.where('normalizedName').equals(normalizedName).first();
    if (existing && existing.id !== tagId) {
      throw new Error('同じ名前のタグがすでにあります。');
    }

    await db.imageTags.update(tagId, { name: trimmed, normalizedName });
    return;
  }
  await renameImageTagDesktop(tagId, name);
}

export async function moveImageTagToCategory(tagId: string, categoryId: string): Promise<void> {
  if (!isTauriRuntime()) {
    await db.imageTags.update(tagId, { categoryId });
    return;
  }
  await moveImageTagCategoryDesktop(tagId, categoryId);
}

export async function mergeImageTags(sourceTagId: string, targetTagId: string): Promise<void> {
  if (!isTauriRuntime()) {
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
    return;
  }
  await mergeImageTagsDesktop(sourceTagId, targetTagId);
}

export async function deleteImageTag(tagId: string): Promise<void> {
  if (!isTauriRuntime()) {
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
    return;
  }
  await deleteImageTagDesktop(tagId);
}

export async function addTagsToImages(imageIds: string[], tagIds: string[]): Promise<void> {
  if (!isTauriRuntime()) {
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
    return;
  }
  await addTagsToImagesDesktop(imageIds, tagIds, 'manual');
}

export async function removeTagsFromImages(imageIds: string[], tagIds: string[]): Promise<void> {
  if (!isTauriRuntime()) {
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
    return;
  }
  await removeTagsFromImagesDesktop(imageIds, tagIds);
}

export async function queryImages(filter: ImageQueryFilter): Promise<ImageRecord[]> {
  if (!isTauriRuntime()) {
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

  return listImagesDesktop({
    mountId: filter.mountId,
    folder: filter.folder,
    tagIds: filter.tagIds ?? [],
    scope: filter.scope,
    folderDepth: filter.folderDepth,
  });
}

export async function getImageTaggingMeta(imageId: string): Promise<ImageTaggingMeta> {
  if (!isTauriRuntime()) {
    const image = await db.images.get(imageId);
    if (!image) throw new Error('画像が見つかりません。');

    const tagIds = uniqueTagIds([...(image.tags ?? []), ...(image.autoTagIds ?? [])]);
    const [mount, tags] = await Promise.all([
      db.imageMounts.get(image.mountId),
      db.imageTags.bulkGet(tagIds),
    ]);
    const tagMap = new Map(
      tags.filter((tag): tag is ImageTagRecord => Boolean(tag)).map((tag) => [tag.id, tag]),
    );

    return {
      image,
      mount: mount ?? null,
      autoTags: (image.autoTagIds ?? [])
        .map((tagId) => tagMap.get(tagId) ?? null)
        .filter((tag): tag is ImageTagRecord => Boolean(tag)),
      manualTags: getImageManualTagIds(image)
        .map((tagId) => tagMap.get(tagId) ?? null)
        .filter((tag): tag is ImageTagRecord => Boolean(tag)),
    };
  }

  return getImageDetailDesktop(imageId);
}

export async function toggleImageFavorite(imageId: string): Promise<void> {
  if (!isTauriRuntime()) {
    const image = await db.images.get(imageId);
    if (!image) return;
    await db.images.update(imageId, {
      favorite: !image.favorite,
      updatedAt: Date.now(),
    });
    return;
  }
  await toggleImageFavoriteDesktop(imageId);
}

export async function getImageFileUrl(image: ImageRecord): Promise<string | null> {
  if (!isTauriRuntime()) {
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
  return getImageFileDataUrlDesktop(image.id);
}

export async function getImageThumbnailUrl(imageId: string): Promise<string | null> {
  if (!isTauriRuntime()) {
    return (await db.images.get(imageId))?.thumbnail ?? null;
  }
  return ensureThumbnailDesktop(imageId);
}

export async function getSubfolders(mountId: string | null, folder: string): Promise<string[]> {
  if (!isTauriRuntime()) {
    if (!mountId) return [];
    const mount = await getBrowserMountById(mountId);
    return fileSystem.listChildDirectories(mount.dirHandle!, folder);
  }
  if (!mountId) return [];
  return listChildDirectoriesDesktop(mountId, folder);
}

export async function createImageSubfolder(
  mountId: string,
  parentFolderPath: string,
  newFolderName: string,
): Promise<void> {
  if (!isTauriRuntime()) {
    const mount = await getBrowserMountById(mountId);
    const trimmed = newFolderName.trim();
    if (!trimmed) throw new Error('フォルダ名を入力してください。');

    const hasPermission = await fileSystem.verifyPermission(mount.dirHandle!, 'readwrite');
    if (!hasPermission) {
      throw new Error('保存先フォルダへの書き込み権限を取得できませんでした。');
    }

    const targetDir = await fileSystem.ensureDirectoryPath(mount.dirHandle!, parentFolderPath);
    await targetDir.getDirectoryHandle(trimmed, { create: true });
    return;
  }
  await createSubdirectoryDesktop(mountId, parentFolderPath, newFolderName);
}

export async function listMissingImages(): Promise<ImageRecord[]> {
  if (!isTauriRuntime()) {
    return db.images.filter((image) => image.isMissing === true).toArray();
  }
  return listMissingImagesDesktop();
}

export async function removeMissingImages(imageIds: string[]): Promise<void> {
  if (!isTauriRuntime()) {
    const images = (await db.images.bulkGet(imageIds)).filter((image): image is ImageRecord => Boolean(image));
    await db.images.bulkDelete(images.map((image) => image.id));
    for (const mountId of new Set(images.map((image) => image.mountId))) {
      await refreshImageCountForMount(mountId);
    }
    await refreshImageTagUsageCounts(images.flatMap((image) => image.tags ?? []));
    return;
  }
  await removeMissingImagesDesktop(imageIds);
}

export async function getBulkRemovableTags(imageIds: string[]): Promise<ImageTagRecord[]> {
  if (!isTauriRuntime()) {
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

  if (imageIds.length === 0) return [];
  const details = await Promise.all(imageIds.map((imageId) => getImageTaggingMeta(imageId)));
  const manualTagSets = details.map((detail) => new Set(detail.manualTags.map((tag) => tag.id)));
  const [first, ...rest] = manualTagSets;
  if (!first) return [];
  const commonIds = [...first].filter((tagId) => rest.every((set) => set.has(tagId)));
  const allTags = await listImageTags();
  return allTags.filter((tag) => commonIds.includes(tag.id));
}

export async function rescanAllImageMounts(): Promise<ImageRescanSummary> {
  if (!isTauriRuntime()) {
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
        await scanImageMount(mount.id);
        scannedMountCount += 1;
      } catch (error) {
        failedMounts.push({
          mountId: mount.id,
          mountName: mount.name,
          message: error instanceof Error ? error.message : 'Failed to rescan mount.',
        });
      }
    }

    return { scannedMountCount, failedMounts };
  }

  const mounts = await listImageMounts();
  const failedMounts: ImageRescanFailure[] = [];
  let scannedMountCount = 0;

  for (const mount of mounts) {
    try {
      await scanImageMount(mount.id);
      scannedMountCount += 1;
    } catch (error) {
      failedMounts.push({
        mountId: mount.id,
        mountName: mount.name,
        message: error instanceof Error ? error.message : 'Failed to rescan mount.',
      });
    }
  }

  return { scannedMountCount, failedMounts };
}

export async function getImageStorageInfo(): Promise<ImageStorageInfo> {
  if (!isTauriRuntime()) {
    return {
      mode: 'tauri-sqlite',
      databaseLabel: 'ブラウザ版では IndexedDB を使用',
      cacheLabel: 'サムネイルは IndexedDB に保存',
    };
  }

  return {
    mode: 'tauri-sqlite',
    databaseLabel: 'SQLite (app data / atelier.db)',
    cacheLabel: 'App cache / image-thumbnails',
  };
}

export async function registerImageFileInMount(input: RegisterImageFileInput): Promise<ImageRecord> {
  if (isTauriRuntime()) {
    throw new Error('registerImageFileInMount is only available in the browser runtime.');
  }
  const record = await upsertBrowserImageRecord(input);
  await refreshImageCountForMount(input.mountId);
  return record;
}

export async function removeImportedImageRecord(imageId: string): Promise<void> {
  if (isTauriRuntime()) {
    throw new Error('removeImportedImageRecord is only available in the browser runtime.');
  }
  const image = await db.images.get(imageId);
  if (!image) return;
  const affectedTagIds = uniqueTagIds(image.tags ?? []);
  await db.images.delete(imageId);
  await refreshImageCountForMount(image.mountId);
  await refreshImageTagUsageCounts(affectedTagIds);
}

export async function importLegacyImageData(payload: string): Promise<LegacyImageImportResult> {
  if (!isTauriRuntime()) {
    throw new Error('旧データの取り込みは Tauri 版で利用してください。');
  }
  return importLegacyImageDataDesktop(payload);
}
