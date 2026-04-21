import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import { db } from '../../db/client';
import type { AppSettings, ImageTagRecord } from '../../types/domain';
import { getImageManualTagIds, listImageTags, sortImageTagsByUsage } from '../../services/imageService';

type CompletedHistoryItem = {
  imageId: string;
  fileName: string;
  thumbnail: string | undefined;
  completedAt: number;
  autoTags: ImageTagRecord[];
  manualTags: ImageTagRecord[];
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'app',
  schemaVersion: 1,
  pinnedTags: [],
  tagSort: 'popular',
  filterMode: 'AND',
  thumbStore: 'idb',
};

export default function ImageTaggingCompletedPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CompletedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [settings, images, tags] = await Promise.all([
          db.settings.get('app'),
          db.images.toArray(),
          listImageTags(),
        ]);

        const history = (settings ?? DEFAULT_APP_SETTINGS).taggingCompletedHistory ?? [];
        const imageMap = new Map(images.map((image) => [image.id, image]));
        const tagMap = new Map(tags.map((tag) => [tag.id, tag]));

        const nextItems = history
          .map<CompletedHistoryItem | null>((entry) => {
            const image = imageMap.get(entry.imageId);
            if (!image) return null;

            return {
              imageId: entry.imageId,
              fileName: image.fileName,
              thumbnail: image.thumbnail,
              completedAt: entry.completedAt,
              autoTags: (image.autoTagIds ?? [])
                .map((tagId) => tagMap.get(tagId) ?? null)
                .filter((tag): tag is ImageTagRecord => Boolean(tag)),
              manualTags: sortImageTagsByUsage(
                getImageManualTagIds(image)
                  .map((tagId) => tagMap.get(tagId) ?? null)
                  .filter((tag): tag is ImageTagRecord => Boolean(tag)),
              ),
            };
          })
          .filter((item): item is CompletedHistoryItem => Boolean(item));

        if (!cancelled) setItems(nextItems);
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
    <div className="mx-auto max-w-6xl p-6">
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
        <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-bg-panel text-text-dim">
          読み込み中...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-bg-panel px-6 py-16 text-center text-text-dim">
          まだ完了履歴はありません
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={`${item.imageId}:${item.completedAt}`}
              className="rounded-2xl border border-border bg-bg-panel p-4"
            >
              <div className="overflow-hidden rounded-xl bg-black/40">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.fileName}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center text-sm text-text-dim">
                    No image
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-main">{item.fileName}</p>
                    <p className="mt-1 text-[11px] text-text-dim">
                      {new Date(item.completedAt).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Link
                    to={`/images/view/${item.imageId}`}
                    className="rounded-lg border border-border bg-bg-surface px-2.5 py-1 text-[11px] text-text-muted transition-colors hover:text-text-main"
                  >
                    詳細
                  </Link>
                </div>

                {(item.autoTags.length > 0 || item.manualTags.length > 0) && (
                  <div className="mt-4 space-y-2">
                    {item.autoTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.autoTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-200"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.manualTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.manualTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full border border-border bg-bg-surface px-2.5 py-1 text-[11px] text-text-muted"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
