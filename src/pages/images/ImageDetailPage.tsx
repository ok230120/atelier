import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiHeartFill, RiHeartLine } from 'react-icons/ri';
import type { ImageMount, ImageRecord, ImageTagRecord } from '../../types/domain';
import {
  addTagsToImages,
  getImageFileUrl,
  getImageManualTagIds,
  getImageTaggingMeta,
  removeTagsFromImages,
  sortImageTagsByUsage,
  toggleImageFavorite,
} from '../../services/imageService';
import ImageDetailTagPanel from './components/ImageDetailTagPanel';

export default function ImageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [image, setImage] = useState<ImageRecord | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tagMap, setTagMap] = useState<Map<string, ImageTagRecord>>(new Map());
  const [mount, setMount] = useState<ImageMount | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const nextDetail = await getImageTaggingMeta(id);
    setImage(nextDetail.image);
    setMount(nextDetail.mount);
    const nextTags = [...nextDetail.autoTags, ...nextDetail.manualTags];
    setTagMap(new Map(nextTags.map((tag) => [tag.id, tag])));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let active = true;

    if (!image) {
      setImageUrl(null);
      return () => undefined;
    }

    void getImageFileUrl(image).then((url) => {
      if (!active) return;
      setImageUrl(url);
    });

    return () => {
      active = false;
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

  const handleToggleFavorite = async () => {
    if (!image) return;
    await toggleImageFavorite(image.id);
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

  const autoTags = useMemo(() => {
    if (!image) return [];
    return (image.autoTagIds ?? [])
      .map((tagId) => tagMap.get(tagId) ?? null)
      .filter((tag): tag is ImageTagRecord => Boolean(tag));
  }, [image, tagMap]);

  const manualTags = useMemo(() => {
    if (!image) return [];
    return sortImageTagsByUsage(
      getImageManualTagIds(image)
        .map((tagId) => tagMap.get(tagId) ?? null)
        .filter((tag): tag is ImageTagRecord => Boolean(tag)),
    );
  }, [image, tagMap]);

  if (!image) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-text-dim">画像を読み込み中です...</p>
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
        ) : mount?.isAvailable === false ? (
          <div className="text-center text-white/70">
            <p className="text-sm">元フォルダが見つからないため表示できません。</p>
            <button
              type="button"
              onClick={() => navigate('/images/manage')}
              className="mt-4 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/15"
            >
              画像管理へ戻る
            </button>
          </div>
        ) : (
          <div className="text-center text-white/40">
            <p className="text-sm">画像を読み込めませんでした。</p>
          </div>
        )}
      </div>

      <aside className="flex w-[26rem] flex-col overflow-y-auto border-l border-border bg-bg-panel xl:w-[30rem]">
        <div className="border-b border-border p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h1 className="break-all font-heading text-sm leading-snug text-text-main">{image.fileName}</h1>
            <button onClick={() => void handleToggleFavorite()} className="mt-0.5 flex-shrink-0">
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
                <span className="text-text-muted">
                  {mount.name}
                  {mount.isAvailable === false && (
                    <span className="ml-2 text-orange-300/80">再指定待ち</span>
                  )}
                </span>
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

          {autoTags.length === 0 && manualTags.length === 0 ? (
            <p className="text-sm text-text-dim">まだ表示中のタグはありません</p>
          ) : (
            <div className="space-y-2">
              {autoTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {autoTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {manualTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {manualTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => void handleRemoveTag(tag.id)}
                      className="group flex items-center gap-1 rounded-full border border-border bg-bg-surface px-2.5 py-1 text-xs text-text-muted transition-colors hover:text-red-300"
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <ImageDetailTagPanel currentTagIds={image.tags} onSelect={handleAddTag} />
        </div>
      </aside>
    </div>
  );
}
