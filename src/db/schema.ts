import Dexie, { Table } from 'dexie';
import { Video, AppSettings, FolderMount } from '../types/domain';

export class AtelierDatabase extends Dexie {
  videos!: Table<Video, string>;
  settings!: Table<AppSettings, string>;
  mounts!: Table<FolderMount, string>;

  constructor() {
    super('AtelierDB');
    (this as any).version(1).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags',
      settings: 'id',
      mounts: 'id, addedAt'
    });
  }
}