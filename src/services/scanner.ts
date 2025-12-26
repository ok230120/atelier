// FILE: src/services/scanner.ts
import { db } from '../db/client';
import type { FolderMount, Video } from '../types/domain';

export interface ScanStats {
  totalFiles: number; // file handles seen (not directories)
  matchedVideoFiles: number;
  added: number;
  updated: number;
  skipped: number;
}

function getExtLower(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

/**
 * File System Access API の型定義が環境/TS設定によって揺れても回せるように、
 * entries()/values()/Symbol.asyncIterator を順にフォールバックして列挙する。
 */
async function* iterateDirectory(
  dirHandle: FileSystemDirectoryHandle,
): AsyncIterable<{ name: string; handle: FileSystemHandle }> {
  const anyDir = dirHandle as any;

  const iterator: AsyncIterableIterator<any> | null =
    typeof anyDir.entries === 'function'
      ? anyDir.entries()
      : typeof anyDir[Symbol.asyncIterator] === 'function'
      ? anyDir[Symbol.asyncIterator]()
      : typeof anyDir.values === 'function'
      ? anyDir.values()
      : null;

  if (!iterator) {
    throw new Error('DirectoryHandle is not iterable (entries/values/asyncIterator missing)');
  }

  for await (const item of iterator) {
    // entries() / asyncIterator() の場合: [name, handle]
    if (Array.isArray(item)) {
      const [name, handle] = item as [string, FileSystemHandle];
      yield { name, handle };
      continue;
    }

    // values() の場合: handle のみ
    const handle = item as FileSystemHandle;
    const name = (handle as any)?.name as string;
    if (typeof name !== 'string') {
      throw new Error('Directory iterator item is missing name');
    }
    yield { name, handle };
  }
}

async function scanDirectoryRecursively(
  dirHandle: FileSystemDirectoryHandle,
  basePath: string,
  mount: FolderMount,
  stats: ScanStats,
  allowedExts: Set<string>,
): Promise<void> {
  for await (const { name, handle } of iterateDirectory(dirHandle)) {
    const relativePath = basePath ? `${basePath}/${name}` : name;

    if (handle.kind === 'file') {
      stats.totalFiles++;

      const ext = getExtLower(name);
      if (!allowedExts.has(ext)) {
        stats.skipped++;
        continue;
      }

      stats.matchedVideoFiles++;

      const id = `${mount.id}::${relativePath}`;

      try {
        const existing = await db.videos.get(id);

        if (existing) {
          // Update only path-related fields; keep user metadata.
          await db.videos.update(id, {
            pathKind: 'handle',
            fileHandle: handle as unknown as FileSystemFileHandle,
            filename: name,
            mountId: mount.id,
            relativePath,
          });
          stats.updated++;
        } else {
          const newVideo: Video = {
            id,
            filename: name,
            titleOverride: undefined,
            pathKind: 'handle',
            fileHandle: handle as unknown as FileSystemFileHandle,
            url: undefined,
            mountId: mount.id,
            relativePath,
            tags: [],
            favorite: false,
            thumbnail: undefined,
            durationSec: undefined,
            addedAt: Date.now(),
            lastPlayedAt: undefined,
            playCount: 0,
          };
          await db.videos.add(newVideo);
          stats.added++;
        }
      } catch (err) {
        console.error(`Error processing file ${relativePath}:`, err);
        stats.skipped++;
      }

      continue;
    }

    if (handle.kind === 'directory') {
      if (mount.includeSubdirs) {
        try {
          await scanDirectoryRecursively(
            handle as unknown as FileSystemDirectoryHandle,
            relativePath,
            mount,
            stats,
            allowedExts,
          );
        } catch (err) {
          console.error(`Error scanning directory ${relativePath}:`, err);
          // not a file, so don't touch totalFiles; still count as skipped
          stats.skipped++;
        }
      } else {
        // ignoring subdirs
        stats.skipped++;
      }
    }
  }
}

/**
 * Scan a folder mount and sync videos into DB.
 */
export async function scanMount(mount: FolderMount): Promise<ScanStats> {
  if (mount.pathKind !== 'handle' || !mount.dirHandle) {
    throw new Error('URL-based mount or missing handle is not supported yet');
  }

  const stats: ScanStats = {
    totalFiles: 0,
    matchedVideoFiles: 0,
    added: 0,
    updated: 0,
    skipped: 0,
  };

  // normalize exts like ["mp4","mkv"] or [".mp4"] both ok
  const allowedExts = new Set(
    (mount.exts || []).map((e) => e.toLowerCase().replace(/^\./, '')).filter(Boolean),
  );

  try {
    await scanDirectoryRecursively(
      mount.dirHandle as unknown as FileSystemDirectoryHandle,
      '',
      mount,
      stats,
      allowedExts,
    );
  } catch (err) {
    console.error(`Scan failed for mount ${mount.name}:`, err);
    throw err;
  }

  return stats;
}
