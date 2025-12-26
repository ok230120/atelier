// FILE: src/db/schema.ts
import Dexie, { Table } from 'dexie';
import type { Video, AppSettings, FolderMount } from '../types/domain';

export class AtelierDatabase extends Dexie {
  videos!: Table<Video, string>;
  settings!: Table<AppSettings, string>;
  mounts!: Table<FolderMount, string>;

  constructor() {
    super('AtelierDB');

    // v1（あなたが既に使ってた定義に合わせる）
    this.version(1).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    // v2（いったん同じでもOK。今後の拡張のために“バージョンを切る”）
    this.version(2).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      settings: 'id',
      mounts: 'id, addedAt',
    });
  }
}
