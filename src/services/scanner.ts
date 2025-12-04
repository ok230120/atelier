import { db } from '../db/client';
import { fileSystem } from './fileSystem';
import { FolderMount, Video } from '../types/domain';

export interface ScanResult {
  added: number;
  updated: number;
  errors: number;
}

export const scanner = {
  /**
   * Scan a mount folder and sync videos to DB
   */
  scanMount: async (mount: FolderMount): Promise<ScanResult> => {
    if (!mount.dirHandle) {
      throw new Error('Directory handle is missing');
    }

    // Verify permission before scanning
    const hasPerm = await fileSystem.verifyPermission(mount.dirHandle, 'read');
    if (!hasPerm) {
      throw new Error('Permission denied. Please grant read access to the folder.');
    }

    const result: ScanResult = { added: 0, updated: 0, errors: 0 };
    
    try {
      // 1. Get all file entries from file system
      const files = await fileSystem.getFilesRecursively(
        mount.dirHandle,
        mount.exts,
        mount.includeSubdirs,
        mount.ignoreGlobs
      );

      // 2. Sync to DB
      // Using a transaction to ensure consistency
      await (db as any).transaction('rw', db.videos, async () => {
        for (const file of files) {
          // Generate a stable ID based on mount ID and relative path
          // This allows us to track files even if they are re-scanned
          const videoId = `${mount.id}:${file.path}`;
          
          const existing = await db.videos.get(videoId);

          if (existing) {
            // Update existing record (refresh file handle, but keep user data)
            const updatedVideo: Video = {
              ...existing,
              fileHandle: file.handle, // Refresh handle in case it changed (though unlikely within same mount)
              relativePath: file.path,
              pathKind: 'handle',
              // Keep other fields like titleOverride, tags, favorite, thumbnail, etc.
            };
            await db.videos.put(updatedVideo);
            result.updated++;
          } else {
            // Create new record
            const newVideo: Video = {
              id: videoId,
              mountId: mount.id,
              pathKind: 'handle',
              fileHandle: file.handle,
              filename: file.name,
              relativePath: file.path,
              tags: [],
              favorite: false,
              addedAt: Date.now(),
              // Optional fields
              // titleOverride: undefined,
              // thumbnail: undefined,
              // durationSec: undefined,
              // lastPlayedAt: undefined,
              // playCount: 0
            };
            await db.videos.put(newVideo);
            result.added++;
          }
        }
      });

      // TODO: Handle deleted files (files in DB but not in FS scan result)
      // For now, we only add/update files. Garbage collection of lost files is a future task.

    } catch (error) {
      console.error('Scan failed:', error);
      throw error;
    }

    return result;
  }
};