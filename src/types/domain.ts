export type Video = {
  id: string;
  titleOverride?: string;
  filename: string;
  pathKind: 'handle' | 'url';
  fileHandle?: FileSystemFileHandle;
  url?: string;
  mountId?: string;
  relativePath?: string;
  tags: string[];
  favorite: boolean;
  thumbnail?: string;
  durationSec?: number;
  addedAt: number;
  lastPlayedAt?: number;
  playCount?: number;
};

export type AppSettings = {
  id: 'app';
  schemaVersion: number;
  pinnedTags: string[];
  tagSort: 'popular' | 'alpha';
  filterMode: 'AND' | 'OR';
  thumbStore: 'idb' | 'folder';
  thumbDirHandle?: FileSystemDirectoryHandle;
  pinnedNovelTags?: string[];
  novelDefaultBackgrounds?: {
    LT?: string;
    LB?: string;
    RT?: string;
    RB?: string;
  };
  novelFontSize?: number;
  novelShowQuadrants?: boolean;
  imageImportRecentFolders?: Array<{
    mountId: string;
    folderPath: string;
    usedAt: number;
  }>;
  imageImportRecentTagIds?: string[];
};

export type FolderMount = {
  id: string;
  name: string;
  color?: string;
  pathKind: 'handle' | 'url';
  dirHandle?: FileSystemDirectoryHandle;
  baseUrl?: string;
  includeSubdirs: boolean;
  exts: string[];
  ignoreGlobs?: string[];
  addedAt: number;
};

export type QuadrantSlot = 'LT' | 'LB' | 'RT' | 'RB';

export type QuadrantSetting = {
  slot: QuadrantSlot;
  startChar: number;
  endChar: number;
  imageType: 'dataUrl' | 'url';
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
  tags: string[];
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
  category: 'novel' | 'video';
  name: string;
  count: number;
  color?: string;
};

export const DEFAULT_IMAGE_TAG_CATEGORY_DEFINITIONS = [
  { id: 'image-category:work', name: '作品', protected: false },
  { id: 'image-category:character', name: 'キャラ', protected: false },
  { id: 'image-category:hair-color', name: '髪色', protected: false },
  { id: 'image-category:hair-style', name: '髪型', protected: false },
  { id: 'image-category:clothing', name: '服装', protected: false },
  { id: 'image-category:legs', name: '脚部', protected: false },
  { id: 'image-category:expression', name: '表情', protected: false },
  { id: 'image-category:attribute', name: '属性', protected: false },
  { id: 'image-category:composition', name: '構図', protected: false },
  { id: 'image-category:other', name: 'その他', protected: true },
] as const;

export const DEFAULT_IMAGE_TAG_CATEGORY_ID = 'image-category:other';

export type ImageTagCategory = string;

export type ImageTagCategoryRecord = {
  id: string;
  name: string;
  order: number;
  createdAt: number;
  protected: boolean;
};

export type ImageRecord = {
  id: string;
  fileName: string;
  relativePath: string;
  folderPath: string;
  mountId: string;
  fileHandle?: FileSystemFileHandle;
  thumbnail?: string;
  tags: string[];
  autoTagIds: string[];
  favorite: boolean;
  addedAt: number;
  updatedAt: number;
  isMissing?: boolean;
  lastSeenAt?: number;
  width?: number;
  height?: number;
};

export type ImageTagRecord = {
  id: string;
  name: string;
  normalizedName: string;
  categoryId: string;
  isAuto: boolean;
  createdAt: number;
  usageCount: number;
};

export type ImageMount = {
  id: string;
  name: string;
  dirHandle?: FileSystemDirectoryHandle;
  includeSubdirs: boolean;
  addedAt: number;
  lastScannedAt?: number;
  imageCount?: number;
};

export type ImageImportSourceKind = 'picker-handle' | 'dropped-file' | 'clipboard-file';

export type ImageImportItem = {
  id: string;
  sourceKind: ImageImportSourceKind;
  fileName: string;
  mimeType: string;
  file?: File;
  fileHandle?: FileSystemFileHandle;
};

export type ImageImportFailureReason =
  | 'duplicate'
  | 'permission'
  | 'write'
  | 'delete-source'
  | 'invalid-destination'
  | 'unsupported-move'
  | 'unknown';

export type ImageImportResultItem = {
  itemId: string;
  fileName: string;
  success: boolean;
  reason?: ImageImportFailureReason;
  message?: string;
  imageId?: string;
};

export type NovelSortOption = 'wordCount' | 'favorite' | 'lastRead' | 'newest' | 'oldest';

export interface Series {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  novelIds: string[];
  addedAt: number;
}
