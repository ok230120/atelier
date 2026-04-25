import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import type { ImageTagRecord } from '../../types/domain';
import {
  getImageAppSettings,
  getImageTaggingMeta,
  getImageThumbnailUrl,
  getNormalizedImageTaggingCompletedHistory,
  sortImageTagsByUsage,
} from '../../services/imageService';

type CompletedItem = {
  imageId: string;
  fileName: string;
  thumbnail?: string;
  completedAt: number;
  autoTags: ImageTagRecord[];
  manualTags: ImageTagRecord[];
};

export default function ImageTaggingCompletedPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const settings = await getImageAppSettings();
        const history = getNormalizedImageTaggingCompletedHistory(settings);
        const nextItems = await Promise.all(
          history.map(async (entry) => {
            try {
              const detail = await getImageTaggingMeta(entry.imageId);
              const thumbnail =
                detail.image.thumbnail ?? (await getImageThumbnailUrl(detail.image.id)) ?? undefined;
              const item: CompletedItem = {
                imageId: entry.imageId,
                fileName: detail.image.fileName,
                completedAt: entry.completedAt,
                autoTags: detail.autoTags,
                manualTags: sortImageTagsByUsage(detail.manualTags),
              };
              if (thumbnail) {
                item.thumbnail = thumbnail;
              }
              return item;
            } catch {
              return null;
            }
          }),
        );

        if (!cancelled) {
          setItems(nextItems.filter((item): item is CompletedItem => Boolean(item)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/images/tagging')}
          className="text-text-dim transition-colors hover:text-text-main"
          aria-label="Back to tagging"
        >
          <RiArrowLeftLine size={20} />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-text-dim">
            Images / Tagging / Completed
          </p>
          <h1 className="font-heading text-2xl text-text-main">Completed</h1>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-bg-panel px-6 py-16 text-center text-text-dim">
          読み込み中...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-bg-panel px-6 py-16 text-center text-text-dim">
          まだ完了した画像はありません。`Next` を押した画像だけがここに表示されます。
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <article
              key={item.imageId}
              className="grid gap-4 rounded-2xl border border-border bg-bg-panel p-4 md:grid-cols-[140px_minmax(0,1fr)]"
            >
              <div className="overflow-hidden rounded-xl bg-bg-surface">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.fileName}
                    className="aspect-square h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-sm text-text-dim">
                    No Image
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="min-w-0">
                  <h2 className="truncate font-heading text-lg text-text-main">{item.fileName}</h2>
                  <p className="mt-1 text-xs text-text-dim">
                    {new Date(item.completedAt).toLocaleString('ja-JP')}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-text-dim">Manual</p>
                  {item.manualTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.manualTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full border border-border bg-bg-surface px-3 py-1 text-xs text-text-main"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-dim">手動タグは未設定です。</p>
                  )}
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-text-dim">Auto</p>
                  {item.autoTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.autoTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-200"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-dim">自動タグはありません。</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
