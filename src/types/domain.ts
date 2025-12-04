// 動画データモデル
export type Video = {
  id: string; // UUID
  titleOverride?: string; // 空ならUI非表示
  filename: string;
  pathKind: "handle" | "url";
  fileHandle?: FileSystemFileHandle; // IndexedDBにはシリアライズできないため、Dexieへの保存時は除外または別途処理が必要だが、型としては保持
  url?: string;
  mountId?: string;
  relativePath?: string;
  tags: string[]; // 小文字正規化
  favorite: boolean;
  thumbnail?: string; // WebP dataURL
  durationSec?: number;
  addedAt: number;
  lastPlayedAt?: number;
  playCount?: number;
};

// アプリケーション設定
export type AppSettings = {
  id: "app";
  schemaVersion: number;
  pinnedTags: string[];
  tagSort: "popular" | "alpha";
  filterMode: "AND" | "OR";
  thumbStore: "idb" | "folder";
  thumbDirHandle?: FileSystemDirectoryHandle;
};

// フォルダマウント設定
export type FolderMount = {
  id: string;
  name: string;
  color?: string;
  pathKind: "handle" | "url";
  dirHandle?: FileSystemDirectoryHandle;
  baseUrl?: string;
  includeSubdirs: boolean;
  exts: string[];
  ignoreGlobs?: string[];
  addedAt: number;
};
