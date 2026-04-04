type DirectoryEntry = FileSystemHandle & {
  values?: () => AsyncIterable<FileSystemHandle>;
};

type OpenFilePickerOptions = {
  multiple?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};

function getDirectoryPicker() {
  return (window as Window & {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
}

function getOpenFilePicker() {
  return (window as Window & {
    showOpenFilePicker?: (
      options?: OpenFilePickerOptions,
    ) => Promise<FileSystemFileHandle[]>;
  }).showOpenFilePicker;
}

async function getDirectoryHandleByPath(
  rootHandle: FileSystemDirectoryHandle,
  folderPath: string,
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle;
  const segments = folderPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create });
  }

  return current;
}

async function listDirectories(dirHandle: FileSystemDirectoryHandle): Promise<string[]> {
  const iterable = (dirHandle as DirectoryEntry).values?.();
  if (!iterable) return [];

  const names: string[] = [];
  for await (const entry of iterable) {
    if (entry.kind === 'directory') names.push(entry.name);
  }

  return names.sort((a, b) => a.localeCompare(b, 'ja'));
}

export const fileSystem = {
  supportsDirectoryPicker(): boolean {
    return typeof getDirectoryPicker() === 'function';
  },

  supportsOpenFilePicker(): boolean {
    return typeof getOpenFilePicker() === 'function';
  },

  getDirectoryPickerUnavailableReason(): string | null {
    if (fileSystem.supportsDirectoryPicker()) return null;
    if (!window.isSecureContext) {
      return 'フォルダ選択は localhost または https の安全な環境で開いているときに使えます。';
    }
    return 'この環境ではフォルダ選択 API を利用できません。Brave の通常ウィンドウで localhost または https 配信になっているか確認してください。';
  },

  getOpenFilePickerUnavailableReason(): string | null {
    if (fileSystem.supportsOpenFilePicker()) return null;
    if (!window.isSecureContext) {
      return 'ファイル選択は localhost または https の安全な環境で開いているときに使えます。';
    }
    return 'この環境ではファイル選択 API を利用できません。Brave の通常ウィンドウで localhost または https 配信になっているか確認してください。';
  },

  async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
    const picker = getDirectoryPicker();
    if (!picker) {
      console.error('Directory picker is unavailable.', {
        isSecureContext: window.isSecureContext,
        userAgent: navigator.userAgent,
      });
      return null;
    }

    try {
      return await picker({ mode: 'read' });
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        try {
          return await picker();
        } catch (retryError: any) {
          if (retryError?.name !== 'AbortError') {
            console.error('pickDirectory failed:', retryError);
          }
        }
      }
      return null;
    }
  },

  async pickImageFiles(): Promise<FileSystemFileHandle[] | null> {
    const picker = getOpenFilePicker();
    if (!picker) {
      console.error('Open file picker is unavailable.', {
        isSecureContext: window.isSecureContext,
        userAgent: navigator.userAgent,
      });
      return null;
    }

    try {
      return await picker({
        multiple: true,
        types: [
          {
            description: 'Images',
            accept: {
              'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.avif'],
            },
          },
        ],
      });
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('pickImageFiles failed:', error);
      }
      return null;
    }
  },

  async verifyPermission(
    handle: FileSystemHandle,
    mode: 'read' | 'readwrite' = 'read',
  ): Promise<boolean> {
    try {
      const opts = { mode } as const;
      const q = (handle as any).queryPermission;
      const r = (handle as any).requestPermission;

      if (typeof q === 'function') {
        const state = await q.call(handle, opts);
        if (state === 'granted') return true;
      }

      if (typeof r === 'function') {
        const state = await r.call(handle, opts);
        if (state === 'granted') return true;
      }

      return false;
    } catch (error) {
      console.error('verifyPermission failed:', error);
      return false;
    }
  },

  async ensureDirectoryPath(
    rootHandle: FileSystemDirectoryHandle,
    folderPath: string,
  ): Promise<FileSystemDirectoryHandle> {
    return getDirectoryHandleByPath(rootHandle, folderPath, true);
  },

  async findDirectoryHandleByPath(
    rootHandle: FileSystemDirectoryHandle,
    folderPath: string,
  ): Promise<FileSystemDirectoryHandle | null> {
    try {
      return await getDirectoryHandleByPath(rootHandle, folderPath, false);
    } catch {
      return null;
    }
  },

  async listChildDirectories(
    rootHandle: FileSystemDirectoryHandle,
    folderPath = '',
  ): Promise<string[]> {
    const target = await fileSystem.findDirectoryHandleByPath(rootHandle, folderPath);
    if (!target) return [];
    return listDirectories(target);
  },

  async fileExists(dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<boolean> {
    try {
      await dirHandle.getFileHandle(fileName, { create: false });
      return true;
    } catch {
      return false;
    }
  },

  async removeFile(
    fileHandle: FileSystemFileHandle,
    fallbackDirHandle?: FileSystemDirectoryHandle,
    fallbackFileName?: string,
  ): Promise<boolean> {
    try {
      const remove = (fileHandle as any).remove;
      if (typeof remove === 'function') {
        await remove.call(fileHandle);
        return true;
      }

      if (fallbackDirHandle && fallbackFileName) {
        await fallbackDirHandle.removeEntry(fallbackFileName);
        return true;
      }

      return false;
    } catch (error) {
      console.error('removeFile failed:', error);
      return false;
    }
  },
};

export default fileSystem;
