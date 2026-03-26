// FILE: src/services/tagService.ts
import { db } from '../db/schema';

/**
 * タグをリネーム
 */
export async function renameTag(
  category: 'novel' | 'video',
  oldName: string,
  newName: string
): Promise<void> {
  const oldId = `${category}:${oldName.toLowerCase()}`;
  const newId = `${category}:${newName.toLowerCase()}`;

  const tag = await db.tags.get(oldId);
  if (!tag) return;

  // 新しいタグを作成
  await db.tags.put({
    ...tag,
    id: newId,
    name: newName,
  });

  // 該当する小説/動画のタグを更新
  if (category === 'novel') {
    const novels = await db.novels.where('tags').equals(oldName.toLowerCase()).toArray();

    for (const novel of novels) {
      const updatedTags = novel.tags.map((t) =>
        t === oldName.toLowerCase() ? newName.toLowerCase() : t
      );
      await db.novels.update(novel.id, { tags: updatedTags });
    }
  } else {
    const videos = await db.videos.where('tags').equals(oldName.toLowerCase()).toArray();

    for (const video of videos) {
      const updatedTags = video.tags.map((t) =>
        t === oldName.toLowerCase() ? newName.toLowerCase() : t
      );
      await db.videos.update(video.id, { tags: updatedTags });
    }
  }

  // 古いタグを削除
  await db.tags.delete(oldId);
}

/**
 * タグを削除（使用されていない場合のみ）
 */
export async function deleteTag(category: 'novel' | 'video', tagName: string): Promise<void> {
  const tagId = `${category}:${tagName.toLowerCase()}`;
  const tag = await db.tags.get(tagId);

  if (tag && tag.count === 0) {
    await db.tags.delete(tagId);
  }
}

/**
 * タグを統合
 */
export async function mergeTags(
  category: 'novel' | 'video',
  sourceTag: string,
  targetTag: string
): Promise<void> {
  const sourceId = `${category}:${sourceTag.toLowerCase()}`;
  const targetId = `${category}:${targetTag.toLowerCase()}`;

  const source = await db.tags.get(sourceId);
  const target = await db.tags.get(targetId);

  if (!source) return;

  // 該当する小説/動画のタグを更新
  if (category === 'novel') {
    const novels = await db.novels.where('tags').equals(sourceTag.toLowerCase()).toArray();

    for (const novel of novels) {
      const updatedTags = novel.tags
        .filter((t) => t !== sourceTag.toLowerCase())
        .concat(targetTag.toLowerCase());
      await db.novels.update(novel.id, { tags: [...new Set(updatedTags)] });
    }
  } else {
    const videos = await db.videos.where('tags').equals(sourceTag.toLowerCase()).toArray();

    for (const video of videos) {
      const updatedTags = video.tags
        .filter((t) => t !== sourceTag.toLowerCase())
        .concat(targetTag.toLowerCase());
      await db.videos.update(video.id, { tags: [...new Set(updatedTags)] });
    }
  }

  // カウントを更新
  if (target) {
    await db.tags.update(targetId, {
      count: target.count + source.count,
    });
  } else {
    await db.tags.put({
      id: targetId,
      category,
      name: targetTag,
      count: source.count,
    });
  }

  // ソースタグを削除
  await db.tags.delete(sourceId);
}

/**
 * 固定タグを取得
 */
export async function getPinnedTags(category: 'novel' | 'video'): Promise<string[]> {
  const settings = await db.settings.get('app');
  if (!settings) return [];

  return category === 'novel' ? settings.pinnedNovelTags || [] : settings.pinnedTags || [];
}

/**
 * 固定タグを設定
 */
export async function setPinnedTags(category: 'novel' | 'video', tags: string[]): Promise<void> {
  const key = category === 'novel' ? 'pinnedNovelTags' : 'pinnedTags';
  await db.settings.update('app', { [key]: tags });
}