// FILE: src/db/schema.ts
import Dexie, { Table } from 'dexie';
import type { Video, AppSettings, FolderMount, Novel, Tag, Series } from '../types/domain';

export class AtelierDatabase extends Dexie {
  videos!: Table<Video, string>;
  novels!: Table<Novel, string>;
  series!: Table<Series, string>;
  tags!: Table<Tag, string>;
  settings!: Table<AppSettings, string>;
  mounts!: Table<FolderMount, string>;

  constructor() {
    super('AtelierDB');

    // v1（既存）
    this.version(1).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    // v2（既存）
    this.version(2).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    // v3（小説機能追加）
    this.version(3).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      novels: 'id, addedAt, lastReadAt, favorite, *tags',
      tags: 'id, category',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    // v4（シリーズ機能追加）
    this.version(4).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      novels: 'id, addedAt, lastReadAt, favorite, *tags, seriesId',
      series: 'id, addedAt',
      tags: 'id, category',
      settings: 'id',
      mounts: 'id, addedAt',
    });
  }
}

export const db = new AtelierDatabase();