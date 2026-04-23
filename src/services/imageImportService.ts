import type {
  ImageImportItem,
  ImageImportResultItem,
  ImageMount,
  ImageRecord,
} from '../types/domain';
import { importImagesDesktop } from './imageDesktopApi';

export type ImageImportProgress = {
  done: number;
  total: number;
};

export type ImageImportSummary = {
  results: ImageImportResultItem[];
  successCount: number;
  failureCount: number;
  importedImageIds: string[];
  importedImages: ImageRecord[];
};

function getExtensionFromMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'image/bmp':
      return 'bmp';
    case 'image/avif':
      return 'avif';
    default:
      return mimeType.startsWith('image/') ? mimeType.slice('image/'.length) || 'png' : 'png';
  }
}

function formatTimestamp(date = new Date()) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  const ss = `${date.getSeconds()}`.padStart(2, '0');
  const ms = `${date.getMilliseconds()}`.padStart(3, '0');
  return `${y}${m}${d}-${hh}${mm}${ss}-${ms}`;
}

function createClipboardFileName(mimeType: string, index = 0) {
  const extension = getExtensionFromMime(mimeType);
  const suffix = index > 0 ? `-${index + 1}` : '';
  return `clipboard-${formatTimestamp()}${suffix}.${extension}`;
}

function withSafeFileName(fileName: string, mimeType: string, index = 0) {
  const trimmed = fileName.trim();
  if (trimmed) return trimmed;
  return createClipboardFileName(mimeType, index);
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function createImportItemsFromDroppedFiles(files: File[]): ImageImportItem[] {
  return files.map((file, index) => ({
    id: crypto.randomUUID(),
    sourceKind: 'dropped-file',
    fileName: withSafeFileName(file.name, file.type, index),
    mimeType: file.type,
    file,
  }));
}

export function createImportItemsFromClipboardEvent(event: ClipboardEvent): ImageImportItem[] {
  const items = Array.from(event.clipboardData?.items ?? []);
  let imageIndex = 0;

  return items
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => {
      const file = item.getAsFile();
      if (!file) return null;

      const nextItem: ImageImportItem = {
        id: crypto.randomUUID(),
        sourceKind: 'clipboard-file',
        fileName: createClipboardFileName(file.type, imageIndex),
        mimeType: file.type,
        file,
      };
      imageIndex += 1;
      return nextItem;
    })
    .filter((item): item is ImageImportItem => Boolean(item));
}

export async function importImageBatch({
  mount,
  folderPath,
  items,
  tagIds,
  onProgress,
}: {
  mount: ImageMount;
  folderPath: string;
  items: ImageImportItem[];
  tagIds: string[];
  onProgress?: (progress: ImageImportProgress) => void;
}): Promise<ImageImportSummary> {
  const payloadItems = [];
  const results: ImageImportResultItem[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.file) {
      results.push({
        itemId: item.id,
        fileName: item.fileName,
        success: false,
        reason: 'unknown',
        message: 'ファイルデータを読み取れませんでした。',
      });
      onProgress?.({ done: index + 1, total: items.length });
      continue;
    }

    payloadItems.push({
      itemId: item.id,
      fileName: item.fileName,
      mimeType: item.mimeType,
      bytesBase64: await fileToBase64(item.file),
    });
    onProgress?.({ done: index + 1, total: items.length });
  }

  const importedImages = await importImagesDesktop({
    mountId: mount.id,
    folderPath,
    items: payloadItems.map((item) => ({
      fileName: item.fileName,
      mimeType: item.mimeType,
      bytesBase64: item.bytesBase64,
    })),
    tagIds,
    mode: 'copy',
  });

  const importedByName = new Map(importedImages.map((image) => [image.fileName, image]));
  for (const item of items) {
    const imported = importedByName.get(item.fileName);
    if (imported) {
      results.push({
        itemId: item.id,
        fileName: item.fileName,
        success: true,
        imageId: imported.id,
      });
    } else if (!results.some((result) => result.itemId === item.id)) {
      results.push({
        itemId: item.id,
        fileName: item.fileName,
        success: false,
        reason: 'duplicate',
        message: '同名ファイルがすでに存在するため、取り込みをスキップしました。',
      });
    }
  }

  const successCount = results.filter((result) => result.success).length;
  return {
    results,
    successCount,
    failureCount: results.length - successCount,
    importedImageIds: importedImages.map((image) => image.id),
    importedImages,
  };
}
