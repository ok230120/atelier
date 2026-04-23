import type {
  AppSettings,
  ImageMount,
  ImageRecord,
  ImageTagCategoryRecord,
  ImageTagRecord,
  LegacyImageImportResult,
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

export type ImageTaggingMeta = DesktopImageTaggingMeta;

export type ImageStorageInfo = {
  mode: 'tauri-sqlite';
  databaseLabel: string;
  cacheLabel: string;
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app',
  schemaVersion: 1,
  pinnedTags: [],
  tagSort: 'popular',
  filterMode: 'AND',
  thumbStore: 'idb',
};

function fromDesktopSettings(settings: DesktopImageAppSettings): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    imageImportRecentFolders: settings.imageImportRecentFolders,
    imageImportRecentTagIds: settings.imageImportRecentTagIds,
    imageTagReadingsBackfillDoneAt: settings.imageTagReadingsBackfillDoneAt,
  };
}

function toDesktopSettings(settings: AppSettings): DesktopImageAppSettings {
  return {
    imageImportRecentFolders: settings.imageImportRecentFolders ?? [],
    imageImportRecentTagIds: settings.imageImportRecentTagIds ?? [],
    imageTagReadingsBackfillDoneAt: settings.imageTagReadingsBackfillDoneAt,
  };
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

export async function getImageAppSettings(): Promise<AppSettings> {
  return fromDesktopSettings(await getImageAppSettingsDesktop());
}

export async function setImageAppSettings(settings: AppSettings): Promise<AppSettings> {
  const nextSettings = await setImageAppSettingsDesktop(toDesktopSettings(settings));
  return fromDesktopSettings(nextSettings);
}

export async function backfillImageTagReadings(): Promise<void> {
  const settings = await getImageAppSettings();
  if (settings.imageTagReadingsBackfillDoneAt) return;
  await setImageAppSettings({
    ...settings,
    imageTagReadingsBackfillDoneAt: Date.now(),
  });
}

export async function listImageMounts(): Promise<ImageMount[]> {
  return listImageMountsDesktop();
}

export async function pickImageMount(): Promise<string | null> {
  return pickImageMountPath();
}

export async function createImageMount(basePath: string, includeSubdirs = true): Promise<ImageMount> {
  return createImageMountDesktop(basePath, includeSubdirs);
}

export async function removeImageMount(mountId: string): Promise<void> {
  await removeImageMountDesktop(mountId);
}

export async function relinkImageMount(mountId: string, basePath: string): Promise<ImageMount> {
  return relinkImageMountDesktop(mountId, basePath);
}

export async function scanImageMount(mountId: string): Promise<ScanProgress> {
  return scanImageMountDesktop(mountId);
}

export async function listImageTagCategories(): Promise<ImageTagCategoryRecord[]> {
  return listImageTagCategoriesDesktop();
}

export async function createImageTagCategory(name: string): Promise<ImageTagCategoryRecord> {
  return createImageTagCategoryDesktop(name);
}

export async function renameImageTagCategory(categoryId: string, name: string): Promise<void> {
  await renameImageTagCategoryDesktop(categoryId, name);
}

export async function reorderImageTagCategories(categoryIds: string[]): Promise<void> {
  await reorderImageTagCategoriesDesktop(categoryIds);
}

export async function deleteImageTagCategory(categoryId: string): Promise<void> {
  await deleteImageTagCategoryDesktop(categoryId);
}

export async function listImageTags(): Promise<ImageTagRecord[]> {
  return listImageTagsDesktop();
}

export async function getOrCreateImageTag(name: string, categoryId: string): Promise<ImageTagRecord> {
  return createImageTagDesktop(name, categoryId);
}

export async function renameImageTag(tagId: string, name: string): Promise<void> {
  await renameImageTagDesktop(tagId, name);
}

export async function moveImageTagToCategory(tagId: string, categoryId: string): Promise<void> {
  await moveImageTagCategoryDesktop(tagId, categoryId);
}

export async function mergeImageTags(sourceTagId: string, targetTagId: string): Promise<void> {
  await mergeImageTagsDesktop(sourceTagId, targetTagId);
}

export async function deleteImageTag(tagId: string): Promise<void> {
  await deleteImageTagDesktop(tagId);
}

export async function addTagsToImages(imageIds: string[], tagIds: string[]): Promise<void> {
  await addTagsToImagesDesktop(imageIds, tagIds, 'manual');
}

export async function removeTagsFromImages(imageIds: string[], tagIds: string[]): Promise<void> {
  await removeTagsFromImagesDesktop(imageIds, tagIds);
}

export async function queryImages(filter: ImageQueryFilter): Promise<ImageRecord[]> {
  return listImagesDesktop({
    mountId: filter.mountId,
    folder: filter.folder,
    tagIds: filter.tagIds ?? [],
    scope: filter.scope,
    folderDepth: filter.folderDepth,
  });
}

export async function getImageTaggingMeta(imageId: string): Promise<ImageTaggingMeta> {
  return getImageDetailDesktop(imageId);
}

export async function toggleImageFavorite(imageId: string): Promise<void> {
  await toggleImageFavoriteDesktop(imageId);
}

export async function getImageFileUrl(image: ImageRecord): Promise<string | null> {
  return getImageFileDataUrlDesktop(image.id);
}

export async function getImageThumbnailUrl(imageId: string): Promise<string | null> {
  return ensureThumbnailDesktop(imageId);
}

export async function getSubfolders(mountId: string | null, folder: string): Promise<string[]> {
  if (!mountId) return [];
  return listChildDirectoriesDesktop(mountId, folder);
}

export async function createImageSubfolder(
  mountId: string,
  parentFolderPath: string,
  newFolderName: string,
): Promise<void> {
  await createSubdirectoryDesktop(mountId, parentFolderPath, newFolderName);
}

export async function listMissingImages(): Promise<ImageRecord[]> {
  return listMissingImagesDesktop();
}

export async function removeMissingImages(imageIds: string[]): Promise<void> {
  await removeMissingImagesDesktop(imageIds);
}

export async function getBulkRemovableTags(imageIds: string[]): Promise<ImageTagRecord[]> {
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
  return {
    mode: 'tauri-sqlite',
    databaseLabel: 'SQLite (app data / atelier.db)',
    cacheLabel: 'App cache / image-thumbnails',
  };
}

export async function importLegacyImageData(payload: string): Promise<LegacyImageImportResult> {
  return importLegacyImageDataDesktop(payload);
}
