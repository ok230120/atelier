import { db } from '../db/client';
import type {
  AppSettings,
  ImageImportFailureReason,
  ImageImportItem,
  ImageImportResultItem,
  ImageMount,
} from '../types/domain';
import {
  addTagsToImages,
  refreshImageTagUsageCounts,
  registerImageFileInMount,
  removeImportedImageRecord,
} from './imageService';
import { fileSystem } from './fileSystem';

export type ImageImportProgress = {
  done: number;
  total: number;
};

export type ImageImportSummary = {
  results: ImageImportResultItem[];
  successCount: number;
  failureCount: number;
  importedImageIds: string[];
};

type ImportStage =
  | 'destination write'
  | 'db register'
  | 'tag update'
  | 'recents update'
  | 'source delete';

class ImportStageError extends Error {
  stage: ImportStage;
  reason: ImageImportFailureReason;

  constructor(stage: ImportStage, reason: ImageImportFailureReason, message: string) {
    super(message);
    this.name = 'ImportStageError';
    this.stage = stage;
    this.reason = reason;
  }
}

function logImportStage(
  item: ImageImportItem,
  stage: ImportStage,
  status: 'start' | 'success' | 'fail',
  error?: unknown,
) {
  const payload = {
    itemId: item.id,
    fileName: item.fileName,
    sourceKind: item.sourceKind,
    stage,
    status,
    error: error instanceof Error ? error.message : error,
  };

  if (status === 'fail') {
    console.error('[image-import]', payload);
    return;
  }

  console.info('[image-import]', payload);
}

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

async function writeFile(
  destinationDir: FileSystemDirectoryHandle,
  fileName: string,
  file: Blob,
): Promise<FileSystemFileHandle> {
  const destinationHandle = await destinationDir.getFileHandle(fileName, { create: true });
  const writable = await destinationHandle.createWritable();
  try {
    await writable.write(file);
  } finally {
    await writable.close();
  }
  return destinationHandle;
}

async function rollbackDestination(
  destinationDir: FileSystemDirectoryHandle,
  destinationHandle: FileSystemFileHandle | null,
  fileName: string,
) {
  if (destinationHandle) {
    const removed = await fileSystem.removeFile(destinationHandle, destinationDir, fileName);
    if (removed) return;
  }

  try {
    await destinationDir.removeEntry(fileName);
  } catch {
    // Ignore rollback failures.
  }
}

function buildFailure(
  item: ImageImportItem,
  reason: ImageImportFailureReason,
  message: string,
): ImageImportResultItem {
  return {
    itemId: item.id,
    fileName: item.fileName,
    success: false,
    reason,
    message,
  };
}

async function updateImportRecents(mountId: string, folderPath: string, tagIds: string[]) {
  const existing = (await db.settings.get('app')) ??
    ({
      id: 'app',
      schemaVersion: 1,
      pinnedTags: [],
      tagSort: 'popular',
      filterMode: 'AND',
      thumbStore: 'idb',
    } satisfies AppSettings);

  const nextFolders = [
    { mountId, folderPath, usedAt: Date.now() },
    ...(existing.imageImportRecentFolders ?? []).filter(
      (entry) => !(entry.mountId === mountId && entry.folderPath === folderPath),
    ),
  ].slice(0, 8);

  const nextTagIds = [
    ...tagIds,
    ...((existing.imageImportRecentTagIds ?? []).filter((tagId) => !tagIds.includes(tagId))),
  ].slice(0, 12);

  await db.settings.put({
    ...existing,
    imageImportRecentFolders: nextFolders,
    imageImportRecentTagIds: nextTagIds,
  });
}

async function getSourceFileForImport(item: ImageImportItem): Promise<File> {
  if (item.sourceKind === 'picker-handle') {
    if (!item.fileHandle) {
      throw new ImportStageError('destination write', 'unknown', '元ファイルを読み込めませんでした。');
    }

    const hasPermission = await fileSystem.verifyPermission(item.fileHandle, 'readwrite');
    if (!hasPermission) {
      throw new ImportStageError(
        'destination write',
        'permission',
        '元ファイルを移動する権限を取得できませんでした。',
      );
    }

    try {
      return await item.fileHandle.getFile();
    } catch {
      throw new ImportStageError('destination write', 'unknown', '元ファイルを読み込めませんでした。');
    }
  }

  if (item.file) return item.file;

  throw new ImportStageError('destination write', 'unknown', 'この画像を読み込めませんでした。');
}

function getFailureFromError(item: ImageImportItem, error: unknown) {
  if (error instanceof ImportStageError) {
    return buildFailure(item, error.reason, error.message);
  }

  return buildFailure(
    item,
    'write',
    error instanceof Error ? error.message : '追加に失敗しました。',
  );
}

export function createImportItemsFromFileHandles(
  handles: FileSystemFileHandle[],
): ImageImportItem[] {
  return handles.map((handle) => ({
    id: crypto.randomUUID(),
    sourceKind: 'picker-handle',
    fileName: handle.name,
    mimeType: '',
    fileHandle: handle,
  }));
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
  if (!mount.dirHandle) {
    throw new Error('選択した保存先フォルダを開けませんでした。');
  }

  const rootPermission = await fileSystem.verifyPermission(mount.dirHandle, 'readwrite');
  if (!rootPermission) {
    throw new Error('保存先フォルダへの書き込み権限を取得できませんでした。');
  }

  const destinationDir = await fileSystem.ensureDirectoryPath(mount.dirHandle, folderPath);
  const results: ImageImportResultItem[] = [];
  const importedImageIds: string[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const fileName = withSafeFileName(item.fileName, item.mimeType, index);
    let destinationHandle: FileSystemFileHandle | null = null;
    let importedImageId: string | null = null;

    try {
      if (await fileSystem.fileExists(destinationDir, fileName)) {
        results.push(buildFailure(item, 'duplicate', '同名ファイルがあります。'));
        onProgress?.({ done: index + 1, total: items.length });
        continue;
      }

      const sourceFile = await getSourceFileForImport(item);

      logImportStage(item, 'destination write', 'start');
      destinationHandle = await writeFile(destinationDir, fileName, sourceFile);
      logImportStage(item, 'destination write', 'success');

      const relativePath = folderPath ? `${folderPath}/${fileName}` : fileName;

      logImportStage(item, 'db register', 'start');
      const image = await registerImageFileInMount({
        mountId: mount.id,
        relativePath,
        fileHandle: destinationHandle,
      });
      importedImageId = image.id;
      importedImageIds.push(image.id);
      logImportStage(item, 'db register', 'success');

      if (tagIds.length > 0) {
        logImportStage(item, 'tag update', 'start');
        await addTagsToImages([image.id], tagIds);
        logImportStage(item, 'tag update', 'success');
      }

      if (item.sourceKind === 'picker-handle') {
        logImportStage(item, 'source delete', 'start');
        const removed = item.fileHandle
          ? await fileSystem.removeFile(item.fileHandle)
          : false;
        if (!removed) {
          throw new ImportStageError(
            'source delete',
            'delete-source',
            '元ファイルの移動を完了できなかったため、この画像は追加していません。',
          );
        }
        logImportStage(item, 'source delete', 'success');
      }

      logImportStage(item, 'recents update', 'start');
      try {
        await updateImportRecents(mount.id, folderPath, tagIds);
        logImportStage(item, 'recents update', 'success');
      } catch (error) {
        logImportStage(item, 'recents update', 'fail', error);
      }

      results.push({
        itemId: item.id,
        fileName,
        success: true,
        imageId: image.id,
      });
    } catch (error) {
      if (error instanceof ImportStageError) {
        logImportStage(item, error.stage, 'fail', error);
      } else if (!destinationHandle) {
        logImportStage(item, 'destination write', 'fail', error);
      } else if (!importedImageId) {
        logImportStage(item, 'db register', 'fail', error);
      } else {
        logImportStage(item, tagIds.length > 0 ? 'tag update' : 'source delete', 'fail', error);
      }

      if (importedImageId) {
        const importedIndex = importedImageIds.indexOf(importedImageId);
        if (importedIndex >= 0) importedImageIds.splice(importedIndex, 1);
        await removeImportedImageRecord(importedImageId);
      }

      await rollbackDestination(destinationDir, destinationHandle, fileName);

      if (tagIds.length > 0) {
        await refreshImageTagUsageCounts(tagIds);
      }

      results.push(getFailureFromError(item, error));
    }

    onProgress?.({ done: index + 1, total: items.length });
  }

  const successCount = results.filter((result) => result.success).length;
  return {
    results,
    successCount,
    failureCount: results.length - successCount,
    importedImageIds,
  };
}
