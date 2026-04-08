import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiCloseLine, RiHeartFill, RiHeartLine } from 'react-icons/ri';
import { db } from '../../db/client';
import type { ImageMount, ImageRecord, ImageTagRecord } from '../../types/domain';
import {
  addTagsToImages,
  getImageFileUrl,
  removeTagsFromImages,
  sortImageTagsByUsage,
} from '../../services/imageService';
import ImageDetailTagPanel from './components/ImageDetailTagPanel';

export default function ImageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [image, setImage] = useState<ImageRecord | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tagObjects, setTagObjects] = useState<ImageTagRecord[]>([]);
  const [mount, setMount] = useState<ImageMount | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const nextImage = await db.images.get(id);
    if (!nextImage) {
      setImage(null);
      return;
    }

    const [tags, nextMount] = await Promise.all([
      db.imageTags.bulkGet(nextImage.tags),
      db.imageMounts.get(nextImage.mountId),
    ]);

    setImage(nextImage);
    setTagObjects(
      sortImageTagsByUsage(tags.filter((tag): tag is ImageTagRecord => Boolean(tag))),
    );
    setMount(nextMount ?? null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!image) {
      setImageUrl(null);
      return () => undefined;
    }

    void getImageFileUrl(image).then((url) => {
      if (!active) {
        if (url) URL.revokeObjectURL(url);
        return;
      }

      objectUrl = url;
      setImageUrl(url);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [image]);

  const handleAddTag = async (tag: ImageTagRecord) => {
    if (!image) return;
    await addTagsToImages([image.id], [tag.id]);
    await load();
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!image) return;
    await removeTagsFromImages([image.id], [tagId]);
    await load();
  };

  const toggleFavorite = async () => {
    if (!image) return;
    await db.images.update(image.id, {
      favorite: !image.favorite,
      updatedAt: Date.now(),
    });
    await load();
  };

  const backToFolder = useMemo(() => {
    if (!image) return '/images';
    const params = new URLSearchParams();
    params.set('mount', image.mountId);
    if (image.folderPath) params.set('folder', image.folderPath);
    params.set('scope', 'current');
    return `/images?${params.toString()}`;
  }, [image]);

  const autoTagIdSet = useMemo(() => new Set(image?.autoTagIds ?? []), [image?.autoTagIds]);

  if (!image) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-text-dim">画像を読み込めませんでした。</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="relative flex flex-1 items-center justify-center bg-black">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-xl bg-black/40 px-3 py-2 text-sm text-white/70 transition-all hover:bg-black/60 hover:text-white"
          >
            <RiArrowLeftLine size={16} />
            戻る
          </button>
          <button
            onClick={() => navigate(backToFolder)}
            className="rounded-xl bg-black/40 px-3 py-2 text-sm text-white/60 transition-all hover:bg-black/60 hover:text-white"
          >
            一覧へ
          </button>
        </div>

        {imageUrl ? (
          <img src={imageUrl} alt={image.fileName} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-center text-white/40">
            <p className="text-sm">画像を読み込めませんでした</p>
            <p className="mt-2 text-xs">ファイルアクセス権限が無効な場合があります。</p>
          </div>
        )}
      </div>

      <aside className="flex w-[26rem] flex-col overflow-y-auto border-l border-border bg-bg-panel xl:w-[30rem]">
        <div className="border-b border-border p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h1 className="break-all font-heading text-sm leading-snug text-text-main">{image.fileName}</h1>
            <button onClick={() => void toggleFavorite()} className="mt-0.5 flex-shrink-0">
              {image.favorite ? (
                <RiHeartFill size={20} className="text-red-400" />
              ) : (
                <RiHeartLine size={20} className="text-text-dim transition-colors hover:text-red-400" />
              )}
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            {mount && (
              <div className="flex gap-2">
                <span className="w-16 shrink-0 text-text-dim">マウント</span>
                <span className="text-text-muted">{mount.name}</span>
              </div>
            )}
            {image.folderPath && (
              <div className="flex gap-2">
                <span className="w-16 shrink-0 text-text-dim">フォルダ</span>
                <span className="break-all text-text-muted">{image.folderPath}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="w-16 shrink-0 text-text-dim">追加日</span>
              <span className="text-text-muted">{new Date(image.addedAt).toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 p-5">
          <div className="mb-3">
            <h2 className="font-heading text-sm text-text-main">タグ</h2>
          </div>

          {tagObjects.length === 0 ? (
            <p className="text-sm text-text-dim">まだ表示中のタグはありません</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tagObjects.map((tag) => (
                <span
                  key={tag.id}
                  className="group flex items-center gap-1 rounded-full border border-border bg-bg-surface px-2.5 py-1 text-xs text-text-muted"
                >
                  {tag.name}
                  {!autoTagIdSet.has(tag.id) && (
                    <button
                      onClick={() => void handleRemoveTag(tag.id)}
                      className="opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                    >
                      <RiCloseLine size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <ImageDetailTagPanel currentTagIds={image.tags} onSelect={handleAddTag} />
        </div>
      </aside>
    </div>
  );
}
