import type {
  ImageMount,
  ImageRecord,
  ImageTagCategoryRecord,
  ImageTagRecord,
  LegacyImageImportResult,
} from '../types/domain';
import { invokeTauri } from './tauri';

export type DesktopImageAppSettings = {
  imageImportRecentFolders: Array<{ mountId: string; folderPath: string; usedAt: number }>;
  imageImportRecentTagIds: string[];
  imageTagReadingsBackfillDoneAt?: number;
};

export type DesktopImageTaggingMeta = {
  image: ImageRecord;
  mount: ImageMount | null;
  autoTags: ImageTagRecord[];
  manualTags: ImageTagRecord[];
};

export type DesktopImageQueryFilter = {
  mountId?: string;
  folder?: string;
  tagIds: string[];
  scope: 'all' | 'current';
  folderDepth?: 'direct' | 'tree';
};

export type DesktopScanProgress = {
  done: number;
  total: number;
  added: number;
  skipped: number;
};

export async function pickImageMountPath() {
  return invokeTauri<string | null>('pick_image_mount');
}

export async function createImageMountDesktop(basePath: string, includeSubdirs = true) {
  return invokeTauri<ImageMount>('create_image_mount', { basePath, includeSubdirs });
}

export async function removeImageMountDesktop(mountId: string) {
  return invokeTauri<void>('remove_image_mount', { mountId });
}

export async function relinkImageMountDesktop(mountId: string, basePath: string) {
  return invokeTauri<ImageMount>('relink_image_mount', { mountId, basePath });
}

export async function listImageMountsDesktop() {
  return invokeTauri<ImageMount[]>('list_image_mounts');
}

export async function scanImageMountDesktop(mountId: string) {
  return invokeTauri<DesktopScanProgress>('scan_image_mount', { mountId });
}

export async function listImagesDesktop(filter: DesktopImageQueryFilter) {
  return invokeTauri<ImageRecord[]>('list_images', { filter });
}

export async function getImageDetailDesktop(imageId: string) {
  return invokeTauri<DesktopImageTaggingMeta>('get_image_detail', { imageId });
}

export async function toggleImageFavoriteDesktop(imageId: string) {
  return invokeTauri<void>('toggle_image_favorite', { imageId });
}

export async function listImageTagCategoriesDesktop() {
  return invokeTauri<ImageTagCategoryRecord[]>('list_image_tag_categories');
}

export async function createImageTagCategoryDesktop(name: string) {
  return invokeTauri<ImageTagCategoryRecord>('create_image_tag_category', { name });
}

export async function renameImageTagCategoryDesktop(categoryId: string, name: string) {
  return invokeTauri<void>('rename_image_tag_category', { categoryId, name });
}

export async function reorderImageTagCategoriesDesktop(categoryIds: string[]) {
  return invokeTauri<void>('reorder_image_tag_categories', { categoryIds });
}

export async function deleteImageTagCategoryDesktop(categoryId: string) {
  return invokeTauri<void>('delete_image_tag_category', { categoryId });
}

export async function listImageTagsDesktop() {
  return invokeTauri<ImageTagRecord[]>('list_image_tags');
}

export async function createImageTagDesktop(name: string, categoryId: string) {
  return invokeTauri<ImageTagRecord>('create_image_tag', { name, categoryId });
}

export async function renameImageTagDesktop(tagId: string, name: string) {
  return invokeTauri<void>('rename_image_tag', { tagId, name });
}

export async function moveImageTagCategoryDesktop(tagId: string, categoryId: string) {
  return invokeTauri<void>('move_image_tag_category', { tagId, categoryId });
}

export async function mergeImageTagsDesktop(sourceTagId: string, targetTagId: string) {
  return invokeTauri<void>('merge_image_tags', { sourceTagId, targetTagId });
}

export async function deleteImageTagDesktop(tagId: string) {
  return invokeTauri<void>('delete_image_tag', { tagId });
}

export async function addTagsToImagesDesktop(
  imageIds: string[],
  tagIds: string[],
  source?: 'manual' | 'auto',
) {
  return invokeTauri<void>('add_tags_to_images', { imageIds, tagIds, source });
}

export async function removeTagsFromImagesDesktop(imageIds: string[], tagIds: string[]) {
  return invokeTauri<void>('remove_tags_from_images', { imageIds, tagIds });
}

export async function listMissingImagesDesktop() {
  return invokeTauri<ImageRecord[]>('list_missing_images');
}

export async function removeMissingImagesDesktop(imageIds: string[]) {
  return invokeTauri<void>('remove_missing_images', { imageIds });
}

export async function listChildDirectoriesDesktop(mountId: string, folderPath = '') {
  return invokeTauri<string[]>('list_child_directories', { mountId, folderPath });
}

export async function createSubdirectoryDesktop(
  mountId: string,
  parentFolderPath: string,
  newFolderName: string,
) {
  return invokeTauri<void>('create_subdirectory', { mountId, parentFolderPath, newFolderName });
}

export async function ensureThumbnailDesktop(imageId: string) {
  return invokeTauri<string | null>('ensure_thumbnail', { imageId });
}

export async function getImageFileDataUrlDesktop(imageId: string) {
  return invokeTauri<string | null>('get_image_file_data_url', { imageId });
}

export async function getImageAppSettingsDesktop() {
  return invokeTauri<DesktopImageAppSettings>('get_image_app_settings');
}

export async function setImageAppSettingsDesktop(settings: DesktopImageAppSettings) {
  return invokeTauri<DesktopImageAppSettings>('set_image_app_settings', { settings });
}

export async function importImagesDesktop(args: {
  mountId: string;
  folderPath: string;
  items: Array<{ fileName: string; mimeType?: string; bytesBase64: string }>;
  tagIds: string[];
  mode?: 'copy';
}) {
  return invokeTauri<ImageRecord[]>('import_images', { args });
}

export async function importLegacyImageDataDesktop(payload: string) {
  return invokeTauri<LegacyImageImportResult>('import_legacy_image_data', { payload });
}
