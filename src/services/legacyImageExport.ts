import { db } from '../db/client';
import type {
  LegacyImageExportData,
  LegacyImageExportPayload,
  LegacyImageMountPayload,
  LegacyImageRecordPayload,
  LegacyImageTagPayload,
} from '../types/domain';

const LEGACY_IMAGE_SCHEMA_VERSION = 1;

function formatDateStamp(date: Date) {
  return date.toISOString().slice(0, 10);
}

function triggerJsonDownload(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildAbsolutePath(basePath: string, relativePath: string, currentAbsolutePath?: string) {
  if (currentAbsolutePath) return currentAbsolutePath;
  if (!basePath) return `__missing__/${relativePath}`;
  const normalizedBase = basePath.replace(/[\\/]+$/, '');
  return `${normalizedBase}/${relativePath}`;
}

function toMountPayload(mount: {
  id: string;
  name: string;
  basePath?: string;
  includeSubdirs: boolean;
  addedAt: number;
  lastScannedAt?: number;
  imageCount?: number;
}): LegacyImageMountPayload {
  return {
    id: mount.id,
    name: mount.name,
    basePath: mount.basePath ?? '',
    includeSubdirs: mount.includeSubdirs,
    addedAt: mount.addedAt,
    lastScannedAt: mount.lastScannedAt,
    imageCount: mount.imageCount,
  };
}

function toImagePayload(
  image: {
    id: string;
    fileName: string;
    relativePath: string;
    folderPath: string;
    mountId: string;
    absolutePath?: string;
    tags: string[];
    autoTagIds: string[];
    favorite: boolean;
    addedAt: number;
    updatedAt: number;
    isMissing?: boolean;
    lastSeenAt?: number;
    width?: number;
    height?: number;
  },
  mountBasePath: string,
): LegacyImageRecordPayload {
  return {
    id: image.id,
    fileName: image.fileName,
    relativePath: image.relativePath,
    folderPath: image.folderPath,
    mountId: image.mountId,
    absolutePath: buildAbsolutePath(mountBasePath, image.relativePath, image.absolutePath),
    tags: image.tags ?? [],
    autoTagIds: image.autoTagIds ?? [],
    favorite: image.favorite,
    addedAt: image.addedAt,
    updatedAt: image.updatedAt,
    isMissing: image.isMissing,
    lastSeenAt: image.lastSeenAt,
    width: image.width,
    height: image.height,
  };
}

function toTagPayload(tag: {
  id: string;
  name: string;
  normalizedName: string;
  searchReadings: string[];
  categoryId: string;
  isAuto: boolean;
  createdAt: number;
  usageCount?: number;
}): LegacyImageTagPayload {
  return {
    id: tag.id,
    name: tag.name,
    normalizedName: tag.normalizedName,
    searchReadings: tag.searchReadings ?? [],
    categoryId: tag.categoryId,
    isAuto: tag.isAuto,
    createdAt: tag.createdAt,
    usageCount: tag.usageCount,
  };
}

export async function exportLegacyImageData(): Promise<void> {
  const [mounts, images, tags, categories, settings] = await Promise.all([
    db.imageMounts.toArray(),
    db.images.toArray(),
    db.imageTags.toArray(),
    db.imageTagCategories.toArray(),
    db.settings.get('app'),
  ]);

  const mountPayloads = mounts.map(toMountPayload);
  const mountBasePathMap = new Map(mountPayloads.map((mount) => [mount.id, mount.basePath]));

  const data: LegacyImageExportPayload = {
    mounts: mountPayloads,
    images: images.map((image) => toImagePayload(image, mountBasePathMap.get(image.mountId) ?? '')),
    tags: tags.map(toTagPayload),
    categories,
    recentFolders: settings?.imageImportRecentFolders ?? [],
    recentTagIds: settings?.imageImportRecentTagIds ?? [],
    imageTagReadingsBackfillDoneAt: settings?.imageTagReadingsBackfillDoneAt,
  };

  const payload: LegacyImageExportData = {
    app: 'atelier',
    kind: 'legacy-image-data',
    schemaVersion: LEGACY_IMAGE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };

  triggerJsonDownload(
    `atelier-legacy-images-${formatDateStamp(new Date())}.json`,
    payload,
  );
}
