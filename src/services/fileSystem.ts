// File System Access API Wrapper

export interface FileEntry {
  handle: FileSystemFileHandle;
  path: string; // relative path from mount root (e.g. "subfolder/movie.mp4")
  name: string;
}

// Add Type Definitions for File System Access API
declare global {
  interface Window {
    showDirectoryPicker: (options?: any) => Promise<FileSystemDirectoryHandle>;
  }

  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }
}

const DEFAULT_EXTENSIONS = ['mp4', 'mkv', 'webm', 'mov'];

export const fileSystem = {
  /**
   * Check if the browser supports File System Access API
   */
  isSupported: (): boolean => {
    return 'showDirectoryPicker' in window;
  },

  /**
   * Open directory picker dialog
   */
  pickDirectory: async (): Promise<FileSystemDirectoryHandle> => {
    if (!window.showDirectoryPicker) {
      throw new Error('File System Access API is not supported');
    }
    return await window.showDirectoryPicker();
  },

  /**
   * Verify and request permission for a handle
   */
  verifyPermission: async (
    handle: FileSystemHandle,
    mode: 'read' | 'readwrite' = 'read'
  ): Promise<boolean> => {
    const options: FileSystemHandlePermissionDescriptor = { mode };
    
    // Check if permission was already granted
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }

    // Request permission
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }

    return false;
  },

  /**
   * Scan directory recursively for video files
   */
  getFilesRecursively: async (
    dirHandle: FileSystemDirectoryHandle,
    extensions: string[] = DEFAULT_EXTENSIONS,
    recursive: boolean = true,
    ignoreGlobs: string[] = [], // TODO: Implement robust glob matching
    currentPath: string = ''
  ): Promise<FileEntry[]> => {
    let files: FileEntry[] = [];
    
    // Convert extensions to lowercase for case-insensitive comparison
    const targetExts = new Set(extensions.map(e => e.toLowerCase().replace(/^\./, '')));

    for await (const entry of dirHandle.values()) {
      // Skip hidden files/folders (starting with dot)
      if (entry.name.startsWith('.')) continue;

      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      // TODO: Implement proper glob matching here if needed
      if (entry.kind === 'file') {
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (ext && targetExts.has(ext)) {
          files.push({
            handle: entry as FileSystemFileHandle,
            path: entryPath,
            name: entry.name
          });
        }
      } else if (entry.kind === 'directory' && recursive) {
        const subFiles = await fileSystem.getFilesRecursively(
          entry as FileSystemDirectoryHandle,
          extensions,
          recursive,
          ignoreGlobs,
          entryPath
        );
        files = [...files, ...subFiles];
      }
    }

    return files;
  }
};