// FILE: src/services/fileSystem.ts
// File System Access API Wrapper

export const fileSystem = {
  /**
   * Directory picker
   */
  pickDirectory: async (): Promise<FileSystemDirectoryHandle | null> => {
    const picker = (window as any).showDirectoryPicker as
      | ((options?: any) => Promise<FileSystemDirectoryHandle>)
      | undefined;

    if (!picker) {
      console.error('File System Access API is not supported (showDirectoryPicker missing).');
      return null;
    }

    try {
      const handle = await picker();
      return handle;
    } catch (err: any) {
      // user cancel or error
      if (err?.name !== 'AbortError') console.error('pickDirectory failed:', err);
      return null;
    }
  },

  /**
   * Verify (and if needed request) permission for a FS handle.
   * Keep compatibility with existing usage in VideoDetailPage.
   */
  verifyPermission: async (
    handle: FileSystemHandle,
    mode: 'read' | 'readwrite' = 'read',
  ): Promise<boolean> => {
    try {
      const opts = { mode } as any;

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
    } catch (err) {
      console.error('verifyPermission failed:', err);
      return false;
    }
  },
};
