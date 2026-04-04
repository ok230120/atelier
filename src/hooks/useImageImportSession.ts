import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/client';
import { fileSystem } from '../services/fileSystem';
import {
  createImportItemsFromClipboardEvent,
  createImportItemsFromDroppedFiles,
  createImportItemsFromFileHandles,
  importImageBatch,
  type ImageImportProgress,
} from '../services/imageImportService';
import {
  getOrCreateImageTag,
  listImageMounts,
  listImageTagCategories,
  listImageTags,
} from '../services/imageService';
import type {
  ImageImportItem,
  ImageImportResultItem,
  ImageMount,
  ImageTagCategoryRecord,
  ImageTagRecord,
} from '../types/domain';

function dedupeImportItems(items: ImageImportItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceKind}:${item.fileName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useImageImportSession() {
  const [mounts, setMounts] = useState<ImageMount[]>([]);
  const [categories, setCategories] = useState<ImageTagCategoryRecord[]>([]);
  const [allTags, setAllTags] = useState<ImageTagRecord[]>([]);
  const [queuedItems, setQueuedItems] = useState<ImageImportItem[]>([]);
  const [selectedMountId, setSelectedMountId] = useState('');
  const [selectedFolderPath, setSelectedFolderPath] = useState('');
  const [childFolders, setChildFolders] = useState<string[]>([]);
  const [recentFolders, setRecentFolders] = useState<
    Array<{ mountId: string; folderPath: string; usedAt: number }>
  >([]);
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<ImageImportProgress>({ done: 0, total: 0 });
  const [results, setResults] = useState<ImageImportResultItem[]>([]);
  const [savedFolder, setSavedFolder] = useState<{ mountId: string; folderPath: string } | null>(
    null,
  );
  const [pickerWarning, setPickerWarning] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedMount = useMemo(
    () => mounts.find((mount) => mount.id === selectedMountId) ?? null,
    [mounts, selectedMountId],
  );

  const refreshMeta = async () => {
    const [nextMounts, nextCategories, nextTags, settings] = await Promise.all([
      listImageMounts(),
      listImageTagCategories(),
      listImageTags(),
      db.settings.get('app'),
    ]);

    setMounts(nextMounts);
    setCategories(nextCategories);
    setAllTags(nextTags);
    setRecentFolders(settings?.imageImportRecentFolders ?? []);
    setRecentTagIds(settings?.imageImportRecentTagIds ?? []);
    setSelectedMountId((prev) => prev || nextMounts[0]?.id || '');
  };

  useEffect(() => {
    void refreshMeta();
    setPickerWarning(fileSystem.getOpenFilePickerUnavailableReason());
  }, []);

  useEffect(() => {
    if (!selectedMount?.dirHandle) {
      setChildFolders([]);
      return;
    }

    void fileSystem
      .listChildDirectories(selectedMount.dirHandle, selectedFolderPath)
      .then(setChildFolders)
      .catch(() => setChildFolders([]));
  }, [selectedFolderPath, selectedMount]);

  const enqueueItems = (items: ImageImportItem[]) => {
    if (items.length === 0) return;
    setQueuedItems((prev) => dedupeImportItems([...prev, ...items]));
    setResults([]);
    setSavedFolder(null);
    setErrorMessage(null);
  };

  const addFromPicker = async () => {
    const handles = await fileSystem.pickImageFiles();
    if (!handles) {
      setErrorMessage(
        fileSystem.getOpenFilePickerUnavailableReason() ?? 'ファイル選択を開けませんでした。',
      );
      return;
    }
    enqueueItems(createImportItemsFromFileHandles(handles));
  };

  const addFromDrop = (files: File[]) => {
    enqueueItems(createImportItemsFromDroppedFiles(files));
  };

  const addFromPaste = (event: ClipboardEvent) => {
    const items = createImportItemsFromClipboardEvent(event);
    if (items.length === 0) return false;
    enqueueItems(items);
    return true;
  };

  const removeQueuedItem = (itemId: string) => {
    setQueuedItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const clearQueue = () => {
    setQueuedItems([]);
  };

  const chooseMount = (mountId: string) => {
    setSelectedMountId(mountId);
    setSelectedFolderPath('');
    setSavedFolder(null);
    setErrorMessage(null);
  };

  const chooseFolder = (folderPath: string) => {
    setSelectedFolderPath(folderPath);
    setSavedFolder(null);
    setErrorMessage(null);
  };

  const openChildFolder = (folderName: string) => {
    setSelectedFolderPath((prev) => (prev ? `${prev}/${folderName}` : folderName));
    setSavedFolder(null);
  };

  const createSubfolder = async (folderName: string) => {
    const trimmed = folderName.trim();
    if (!trimmed || !selectedMount?.dirHandle) return;
    setErrorMessage(null);

    try {
      const nextFolderPath = selectedFolderPath ? `${selectedFolderPath}/${trimmed}` : trimmed;
      const existing = await fileSystem.findDirectoryHandleByPath(
        selectedMount.dirHandle,
        nextFolderPath,
      );
      if (existing) {
        setErrorMessage('同じ名前のフォルダがすでにあります。');
        return;
      }

      const baseHandle = await fileSystem.ensureDirectoryPath(
        selectedMount.dirHandle,
        selectedFolderPath,
      );
      await baseHandle.getDirectoryHandle(trimmed, { create: true });
      setSelectedFolderPath(nextFolderPath);
      setSavedFolder(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'フォルダを作成できませんでした。');
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((current) => current !== tagId) : [...prev, tagId],
    );
  };

  const createTag = async (name: string, categoryId: string) => {
    const tag = await getOrCreateImageTag(name, categoryId);
    await refreshMeta();
    setSelectedTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
    return tag;
  };

  const submitImport = async () => {
    if (!selectedMount) {
      setErrorMessage('保存先フォルダを選んでください。');
      return;
    }

    if (queuedItems.length === 0) {
      setErrorMessage('追加する画像がありません。');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setResults([]);
    setProgress({ done: 0, total: queuedItems.length });

    try {
      const summary = await importImageBatch({
        mount: selectedMount,
        folderPath: selectedFolderPath,
        items: queuedItems,
        tagIds: selectedTagIds,
        onProgress: setProgress,
      });

      setResults(summary.results);
      setSavedFolder(
        summary.successCount > 0
          ? { mountId: selectedMount.id, folderPath: selectedFolderPath }
          : null,
      );
      setQueuedItems([]);
      await refreshMeta();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '追加に失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    mounts,
    categories,
    allTags,
    queuedItems,
    selectedMountId,
    selectedMount,
    selectedFolderPath,
    childFolders,
    recentFolders,
    recentTagIds,
    selectedTagIds,
    isSaving,
    progress,
    results,
    savedFolder,
    pickerWarning,
    errorMessage,
    addFromPicker,
    addFromDrop,
    addFromPaste,
    removeQueuedItem,
    clearQueue,
    chooseMount,
    chooseFolder,
    openChildFolder,
    createSubfolder,
    toggleTag,
    createTag,
    submitImport,
  };
}
