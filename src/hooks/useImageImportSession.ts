import { useEffect, useMemo, useState } from 'react';
import {
  createImportItemsFromClipboardEvent,
  createImportItemsFromDroppedFiles,
  importImageBatch,
  type ImageImportProgress,
} from '../services/imageImportService';
import {
  backfillImageTagReadings,
  createImageMount,
  createImageSubfolder,
  getImageAppSettings,
  getOrCreateImageTag,
  getSubfolders,
  listImageMounts,
  listImageTagCategories,
  listImageTags,
  pickImageMount,
} from '../services/imageService';
import { isTauriRuntime } from '../services/tauri';
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

function pickFilesFromInput(): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

export function useImageImportSession() {
  const tauriRuntime = isTauriRuntime();
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
    if (!tauriRuntime) {
      setMounts([]);
      setCategories([]);
      setAllTags([]);
      setRecentFolders([]);
      setRecentTagIds([]);
      setSelectedMountId('');
      return;
    }
    const [nextMounts, nextCategories, nextTags, settings] = await Promise.all([
      listImageMounts(),
      listImageTagCategories(),
      listImageTags(),
      getImageAppSettings(),
    ]);
    const availableMounts = nextMounts.filter((mount) => mount.isAvailable !== false);

    setMounts(availableMounts);
    setCategories(nextCategories);
    setAllTags(nextTags);
    setRecentFolders(settings.imageImportRecentFolders ?? []);
    setRecentTagIds(settings.imageImportRecentTagIds ?? []);
    setSelectedMountId((prev) =>
      availableMounts.some((mount) => mount.id === prev) ? prev : availableMounts[0]?.id || '',
    );
  };

  useEffect(() => {
    void refreshMeta();
    void backfillImageTagReadings().then(() => refreshMeta()).catch(() => undefined);
    setPickerWarning(null);
  }, [tauriRuntime]);

  useEffect(() => {
    if (!selectedMountId) {
      setChildFolders([]);
      return;
    }

    void getSubfolders(selectedMountId, selectedFolderPath)
      .then(setChildFolders)
      .catch(() => setChildFolders([]));
  }, [selectedFolderPath, selectedMountId]);

  const enqueueItems = (items: ImageImportItem[]) => {
    if (items.length === 0) return;
    setQueuedItems((prev) => dedupeImportItems([...prev, ...items]));
    setResults([]);
    setSavedFolder(null);
    setErrorMessage(null);
  };

  const addFromPicker = async () => {
    const files = await pickFilesFromInput();
    if (!files) return;
    enqueueItems(createImportItemsFromDroppedFiles(files));
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
    if (!trimmed || !selectedMount) return;
    setErrorMessage(null);

    try {
      await createImageSubfolder(selectedMount.id, selectedFolderPath, trimmed);
      const nextFolderPath = selectedFolderPath ? `${selectedFolderPath}/${trimmed}` : trimmed;
      setSelectedFolderPath(nextFolderPath);
      setSavedFolder(null);
      setChildFolders(await getSubfolders(selectedMount.id, nextFolderPath));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'フォルダの作成に失敗しました。');
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
      setErrorMessage('保存先フォルダを選択してください。');
      return;
    }

    if (queuedItems.length === 0) {
      setErrorMessage('取り込む画像がありません。');
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
      setErrorMessage(error instanceof Error ? error.message : '取り込みに失敗しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const addMountFromDialog = async () => {
    if (!tauriRuntime) {
      setPickerWarning('旧ブラウザ版ではフォルダ追加は使えません。設定から画像データを書き出してください。');
      return null;
    }
    setPickerWarning(null);
    const basePath = await pickImageMount();
    if (!basePath) return null;

    try {
      const mount = await createImageMount(basePath, true);
      await refreshMeta();
      setSelectedMountId(mount.id);
      setSelectedFolderPath('');
      return basePath;
    } catch (error) {
      setPickerWarning(error instanceof Error ? error.message : 'フォルダの登録に失敗しました。');
      return null;
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
    addMountFromDialog,
  };
}
