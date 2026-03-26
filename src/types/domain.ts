// FILE: src/types/domain.ts

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

  // ===== 動画用設定 =====
  pinnedTags: string[];
  tagSort: "popular" | "alpha";
  filterMode: "AND" | "OR";
  thumbStore: "idb" | "folder";
  thumbDirHandle?: FileSystemDirectoryHandle;

  // ===== 小説用設定（追加） =====
  pinnedNovelTags?: string[];
  novelDefaultBackgrounds?: {
    LT?: string;
    LB?: string;
    RT?: string;
    RB?: string;
  };
  novelFontSize?: number;
  novelShowQuadrants?: boolean;
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

// ===== 小説機能の型定義（追加） =====

export type QuadrantSlot = "LT" | "LB" | "RT" | "RB";

export type QuadrantSetting = {
  slot: QuadrantSlot;
  startChar: number;
  endChar: number;
  imageType: "dataUrl" | "url";
  imageDataUrl?: string;
  imageUrl?: string;
};

export type Novel = {
  id: string;
  title: string;
  summary: string;
  content: string;
  pages: string[];
  pageCount: number;
  thumbnail?: string;
  wordCount: number;
  tags: string[]; // 小文字正規化 推奨
  favorite: boolean;
  seriesId?: string;
  quadrantSettings: QuadrantSetting[];
  previousVersion?: {
    content: string;
    savedAt: number;
  };
  addedAt: number;
  lastReadAt?: number;
  readCount: number;
};

export type Tag = {
  id: string;
  category: "novel" | "video";
  name: string;
  count: number;
  color?: string;
};

export type NovelSortOption =
  | "wordCount"
  | "favorite"
  | "lastRead"
  | "newest"
  | "oldest";

export interface Series {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  novelIds: string[]; // 小説IDの配列（順序を保持）
  addedAt: number;
}