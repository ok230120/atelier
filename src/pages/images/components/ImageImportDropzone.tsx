import { useEffect, useState } from 'react';
import { RiClipboardLine, RiDragDropLine, RiFolderUploadLine } from 'react-icons/ri';

type Props = {
  onPickFiles: () => void | Promise<void>;
  onDropFiles: (files: File[]) => void;
  onPasteEvent: (event: ClipboardEvent) => boolean;
  pickerWarning?: string | null;
};

function extractImageFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return [];
  return Array.from(dataTransfer.files).filter((file) => file.type.startsWith('image/'));
}

export default function ImageImportDropzone({
  onPickFiles,
  onDropFiles,
  onPasteEvent,
  pickerWarning,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const accepted = onPasteEvent(event);
      if (accepted) event.preventDefault();
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onPasteEvent]);

  return (
    <section className="rounded-2xl border border-border bg-bg-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg text-text-main">画像を追加</h2>
          <p className="mt-1 text-sm text-text-dim">
            画像を入れて、保存先フォルダとタグを決めたらそのまま取り込めます。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onPickFiles()}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm text-white transition-colors hover:bg-blue-500"
        >
          <RiFolderUploadLine size={16} />
          ファイルを選択
        </button>
      </div>

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          onDropFiles(extractImageFiles(event.dataTransfer));
        }}
        className={
          isDragging
            ? 'rounded-2xl border border-accent/50 bg-accent/10 px-5 py-10 text-center'
            : 'rounded-2xl border border-dashed border-border px-5 py-10 text-center'
        }
      >
        <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
          <div className="flex items-center gap-3 text-text-dim">
            <RiDragDropLine size={24} />
            <RiClipboardLine size={22} />
          </div>
          <p className="font-heading text-base text-text-main">
            ここに画像をドラッグするか、Ctrl+V で貼り付け
          </p>
          <p className="text-sm text-text-dim">
            ドロップと貼り付けは新規画像として取り込みます。ファイル選択でも追加できます。
          </p>
          {pickerWarning && <p className="text-xs text-orange-200">{pickerWarning}</p>}
        </div>
      </div>
    </section>
  );
}
