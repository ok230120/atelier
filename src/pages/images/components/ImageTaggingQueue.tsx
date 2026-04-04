import { RiImageLine } from 'react-icons/ri';
import type { ImageRecord } from '../../../types/domain';

type Props = {
  items: ImageRecord[];
  selectedImageId: string | null;
  onSelect: (imageId: string) => void;
};

export default function ImageTaggingQueue({ items, selectedImageId, onSelect }: Props) {
  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-bg-panel">
      <div className="border-b border-border px-4 py-4">
        <h2 className="font-heading text-lg text-text-main">未整理画像</h2>
        <p className="mt-1 text-sm text-text-dim">{items.length} 件</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <RiImageLine size={34} className="text-text-dim" />
          <p className="text-sm text-text-dim">手動タグがまだ付いていない画像はありません。</p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 xl:grid-cols-3">
          {items.map((image) => (
            <button
              key={image.id}
              type="button"
              onClick={() => onSelect(image.id)}
              className={
                image.id === selectedImageId
                  ? 'group rounded-xl border border-accent bg-bg-surface p-2 text-left shadow-[0_0_0_2px_rgba(59,130,246,0.25)]'
                  : 'group rounded-xl border border-border bg-bg-surface p-2 text-left transition-colors hover:border-border-light'
              }
            >
              <div className="aspect-square overflow-hidden rounded-lg bg-bg-panel">
                {image.thumbnail ? (
                  <img
                    src={image.thumbnail}
                    alt={image.fileName}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-text-dim">
                    <RiImageLine size={24} />
                  </div>
                )}
              </div>
              <p className="mt-2 truncate text-xs text-text-main">{image.fileName}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
