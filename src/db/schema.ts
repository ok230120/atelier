import Dexie, { Table } from 'dexie';
import type {
  AppSettings,
  FolderMount,
  ImageMount,
  ImageRecord,
  ImageTagCategoryRecord,
  ImageTagRecord,
  Novel,
  Series,
  Tag,
  Video,
} from '../types/domain';
import { DEFAULT_IMAGE_TAG_CATEGORY_ID, DEFAULT_IMAGE_TAG_CATEGORY_DEFINITIONS as DEFAULT_CATEGORIES } from '../types/domain';

function normalizeImageTagName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[ァ-ヴ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/ー/g, '');
}

function uniqueTagIds(tagIds: string[]) {
  return Array.from(new Set(tagIds.filter(Boolean)));
}

function buildDefaultImageTagCategories(now: number): ImageTagCategoryRecord[] {
  return DEFAULT_CATEGORIES.map((category, index) => ({
    id: category.id,
    name: category.name,
    order: index,
    createdAt: now,
    protected: category.protected,
  }));
}

export class AtelierDatabase extends Dexie {
  videos!: Table<Video, string>;
  novels!: Table<Novel, string>;
  series!: Table<Series, string>;
  tags!: Table<Tag, string>;
  images!: Table<ImageRecord, string>;
  imageTags!: Table<ImageTagRecord, string>;
  imageTagCategories!: Table<ImageTagCategoryRecord, string>;
  imageMounts!: Table<ImageMount, string>;
  settings!: Table<AppSettings, string>;
  mounts!: Table<FolderMount, string>;

  constructor() {
    super('AtelierDB');

    this.version(1).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    this.version(2).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    this.version(3).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      novels: 'id, addedAt, lastReadAt, favorite, *tags',
      tags: 'id, category',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    this.version(4).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      novels: 'id, addedAt, lastReadAt, favorite, *tags, seriesId',
      series: 'id, addedAt',
      tags: 'id, category',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    this.version(5).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      novels: 'id, addedAt, lastReadAt, favorite, *tags, seriesId',
      series: 'id, addedAt',
      tags: 'id, category',
      images: 'id, mountId, addedAt, updatedAt, favorite, folderPath, *tags, [mountId+relativePath]',
      imageTags: 'id, &normalizedName, category, usageCount, name',
      imageMounts: 'id, addedAt, lastScannedAt',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    this.version(6).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      novels: 'id, addedAt, lastReadAt, favorite, *tags, seriesId',
      series: 'id, addedAt',
      tags: 'id, category',
      images:
        'id, mountId, addedAt, updatedAt, favorite, folderPath, isMissing, lastSeenAt, *tags, *autoTagIds, [mountId+relativePath]',
      imageTags: 'id, &normalizedName, category, usageCount, name',
      imageMounts: 'id, addedAt, lastScannedAt',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    this.version(7).stores({
      videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
      novels: 'id, addedAt, lastReadAt, favorite, *tags, seriesId',
      series: 'id, addedAt',
      tags: 'id, category',
      images:
        'id, mountId, addedAt, updatedAt, favorite, folderPath, isMissing, lastSeenAt, *tags, *autoTagIds, [mountId+relativePath]',
      imageTags: 'id, &normalizedName, category, usageCount, name',
      imageMounts: 'id, addedAt, lastScannedAt',
      settings: 'id',
      mounts: 'id, addedAt',
    });

    this.version(8)
      .stores({
        videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
        novels: 'id, addedAt, lastReadAt, favorite, *tags, seriesId',
        series: 'id, addedAt',
        tags: 'id, category',
        images:
          'id, mountId, addedAt, updatedAt, favorite, folderPath, isMissing, lastSeenAt, *tags, *autoTagIds, [mountId+relativePath]',
        imageTags: 'id, &normalizedName, category, usageCount, name',
        imageMounts: 'id, addedAt, lastScannedAt',
        settings: 'id',
        mounts: 'id, addedAt',
      })
      .upgrade(async (tx) => {
        const imageTagsTable = tx.table<ImageTagRecord>('imageTags');
        const imagesTable = tx.table<ImageRecord>('images');
        const [tags, images] = await Promise.all([imageTagsTable.toArray(), imagesTable.toArray()]);

        const groups = new Map<string, ImageTagRecord[]>();
        for (const tag of tags) {
          const normalizedName = normalizeImageTagName(tag.name);
          const existing = groups.get(normalizedName);
          if (existing) existing.push(tag);
          else groups.set(normalizedName, [tag]);
        }

        const remap = new Map<string, string>();
        const tagsToDelete: string[] = [];

        for (const [normalizedName, group] of groups) {
          const sorted = [...group].sort((a, b) => {
            if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
            if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
            return a.id.localeCompare(b.id);
          });

          const canonical = sorted[0];
          await imageTagsTable.put({
            ...canonical,
            normalizedName,
          });

          for (const duplicate of sorted.slice(1)) {
            remap.set(duplicate.id, canonical.id);
            tagsToDelete.push(duplicate.id);
          }
        }

        if (remap.size > 0) {
          for (const image of images) {
            const nextTags = uniqueTagIds(image.tags.map((tagId) => remap.get(tagId) ?? tagId));
            const nextAutoTagIds = uniqueTagIds(
              (image.autoTagIds ?? []).map((tagId) => remap.get(tagId) ?? tagId),
            );

            await imagesTable.put({
              ...image,
              tags: nextTags,
              autoTagIds: nextAutoTagIds,
            });
          }
        }

        if (tagsToDelete.length > 0) {
          await imageTagsTable.bulkDelete(tagsToDelete);
        }

        const [finalTags, finalImages] = await Promise.all([
          imageTagsTable.toArray(),
          imagesTable.toArray(),
        ]);

        for (const tag of finalTags) {
          const usageCount = finalImages.filter(
            (image) => image.isMissing !== true && image.tags.includes(tag.id),
          ).length;
          await imageTagsTable.update(tag.id, { usageCount });
        }
      });

    this.version(9)
      .stores({
        videos: 'id, mountId, addedAt, favorite, durationSec, *tags, [mountId+addedAt]',
        novels: 'id, addedAt, lastReadAt, favorite, *tags, seriesId',
        series: 'id, addedAt',
        tags: 'id, category',
        images:
          'id, mountId, addedAt, updatedAt, favorite, folderPath, isMissing, lastSeenAt, *tags, *autoTagIds, [mountId+relativePath]',
        imageTags: 'id, &normalizedName, categoryId, isAuto, usageCount, name',
        imageTagCategories: 'id, &name, order, protected, createdAt',
        imageMounts: 'id, addedAt, lastScannedAt',
        settings: 'id',
        mounts: 'id, addedAt',
      })
      .upgrade(async (tx) => {
        const now = Date.now();
        const categoriesTable = tx.table<ImageTagCategoryRecord>('imageTagCategories');
        const imageTagsTable = tx.table<any>('imageTags');
        const imagesTable = tx.table<ImageRecord>('images');

        const existingCategories = await categoriesTable.toArray();
        if (existingCategories.length === 0) {
          await categoriesTable.bulkAdd(buildDefaultImageTagCategories(now));
        }

        const categories = await categoriesTable.toArray();
        const fallbackCategoryId =
          categories.find((category) => category.protected)?.id ?? DEFAULT_IMAGE_TAG_CATEGORY_ID;
        const categoryIdByName = new Map(
          DEFAULT_CATEGORIES.map((category) => [category.name, category.id]),
        );

        const [tags, images] = await Promise.all([imageTagsTable.toArray(), imagesTable.toArray()]);
        const autoTagIds = new Set(images.flatMap((image) => image.autoTagIds ?? []));

        for (const tag of tags) {
          const legacyCategory = typeof tag.category === 'string' ? tag.category : undefined;
          const isAuto = tag.isAuto ?? autoTagIds.has(tag.id);
          const categoryId =
            isAuto
              ? fallbackCategoryId
              : tag.categoryId ??
                (legacyCategory ? categoryIdByName.get(legacyCategory) : undefined) ??
                fallbackCategoryId;

          await imageTagsTable.put({
            ...tag,
            categoryId,
            isAuto,
          });
        }
      });
  }
}

export const db = new AtelierDatabase();
export default db;
