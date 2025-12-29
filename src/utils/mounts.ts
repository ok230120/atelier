// FILE: src/utils/mounts.ts
import type { FolderMount } from '../types/domain';

/**
 * After restore/import, FileSystem handles can't be restored.
 * So handle-based mounts may need re-linking.
 */
export function needsRelinkMount(m: FolderMount): boolean {
  // URL mounts never need relink
  if (m.pathKind === 'url') return false;

  // handle mounts need dirHandle
  return !m.dirHandle;
}
