import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiDeleteBin7Line,
  RiErrorWarningLine,
  RiFolderAddLine,
  RiImageAddLine,
  RiPriceTag3Line,
  RiRefreshLine,
} from 'react-icons/ri';
import { db } from '../../db/client';
import type { ImageMount, ImageRecord } from '../../types/domain';
import { fileSystem } from '../../services/fileSystem';
import {
  listImageMounts,
  listMissingImages,
  removeMissingImages,
  scanImageMount,
  type ScanProgress,
} from '../../services/imageService';

export default function ImageManagePage() {
  const navigate = useNavigate();
  const [mounts, setMounts] = useState<ImageMount[]>([]);
  const [missingImages, setMissingImages] = useState<ImageRecord[]>([]);
  const [scanning, setScanning] = useState<Record<string, ScanProgress>>({});
  const [isPicking, setIsPicking] = useState(false);
  const [isCleaningMissing, setIsCleaningMissing] = useState(false);
  const [pickerWarning, setPickerWarning] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const runtimeInfo = {
    origin: window.location.origin,
    href: window.location.href,
    secureContext: window.isSecureContext ? 'yes' : 'no',
    directoryPicker: typeof window.showDirectoryPicker === 'function' ? 'available' : 'missing',
  };

  const mountNameMap = useMemo(
    () => new Map(mounts.map((mount) => [mount.id, mount.name])),
    [mounts],
  );

  const reload = async () => {
    const [nextMounts, nextMissingImages] = await Promise.all([listImageMounts(), listMissingImages()]);
    setMounts(nextMounts);
    setMissingImages(nextMissingImages);
  };

  useEffect(() => {
    void reload();
    setPickerWarning(fileSystem.getDirectoryPickerUnavailableReason());
  }, []);

  const runScan = async (mountId: string, dirHandle: FileSystemDirectoryHandle) => {
    setScanning((prev) => ({ ...prev, [mountId]: { done: 0, total: 0, added: 0, skipped: 0 } }));
    try {
      await scanImageMount(mountId, dirHandle, (progress) => {
        setScanning((prev) => ({ ...prev, [mountId]: progress }));
      });
    } finally {
      setScanning((prev) => {
        const next = { ...prev };
        delete next[mountId];
        return next;
      });
      await reload();
    }
  };

  const addMount = async () => {
    if (isPicking) return;
    setIsPicking(true);
    setActionMessage(null);

    try {
      const dirHandle = await fileSystem.pickDirectory();
      if (!dirHandle) {
        setActionMessage(
          fileSystem.getDirectoryPickerUnavailableReason() ??
            'フォルダ選択を開けませんでした。Brave の通常ウィンドウで localhost または https を確認してください。',
        );
        return;
      }

      const mount: ImageMount = {
        id: crypto.randomUUID(),
        name: dirHandle.name,
        dirHandle,
        includeSubdirs: true,
        addedAt: Date.now(),
      };

      await db.imageMounts.add(mount);
      await reload();
      await runScan(mount.id, dirHandle);
    } finally {
      setIsPicking(false);
    }
  };

  const rescan = async (mount: ImageMount) => {
    if (!mount.dirHandle) return;
    await runScan(mount.id, mount.dirHandle);
  };

  const removeMount = async (mountId: string) => {
    if (!window.confirm('このマウントと画像メタ情報を削除しますか？元ファイルは削除されません。')) {
      return;
    }

    await db.images.where('mountId').equals(mountId).delete();
    await db.imageMounts.delete(mountId);
    await reload();
  };

  const handleRemoveMissing = async (imageId: string) => {
    if (!window.confirm('この見つからない画像レコードを削除しますか？')) {
      return;
    }

    setIsCleaningMissing(true);
    setActionMessage(null);
    try {
      await removeMissingImages([imageId]);
      await reload();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '見つからない画像の削除に失敗しました。');
    } finally {
      setIsCleaningMissing(false);
    }
  };

  const handleRemoveAllMissing = async () => {
    if (missingImages.length === 0) return;
    if (!window.confirm(`見つからない画像を ${missingImages.length} 件まとめて削除しますか？`)) {
      return;
    }

    setIsCleaningMissing(true);
    setActionMessage(null);
    try {
      await removeMissingImages(missingImages.map((image) => image.id));
      await reload();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '見つからない画像の一括削除に失敗しました。');
    } finally {
      setIsCleaningMissing(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-5xl p-6">
      <div className="relative z-10 mb-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/images')}
          className="text-text-dim transition-colors hover:text-text-muted"
          aria-label="Back to images"
        >
          <RiArrowLeftLine size={20} />
        </button>

        <div>
          <h1 className="font-heading text-2xl text-text-main">フォルダ管理</h1>
          <p className="mt-0.5 text-sm text-text-dim">
            画像フォルダを追加して、再スキャンやメンテナンスを行います。
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/images/import')}
            className="flex items-center gap-2 rounded-xl border border-border bg-bg-panel px-4 py-2.5 text-sm text-text-main transition-colors hover:text-accent"
          >
            <RiImageAddLine size={16} />
            追加ページへ
          </button>
          <button
            type="button"
            onClick={() => navigate('/images/tags')}
            className="flex items-center gap-2 rounded-xl border border-border bg-bg-panel px-4 py-2.5 text-sm text-text-main transition-colors hover:text-accent"
          >
            <RiPriceTag3Line size={16} />
            タグ管理
          </button>
          <button
            type="button"
            onClick={() => void addMount()}
            disabled={isPicking}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RiFolderAddLine size={16} />
            {isPicking ? 'フォルダを開いています...' : 'フォルダを追加'}
          </button>
        </div>
      </div>

      {pickerWarning && (
        <div className="mb-6 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
          {pickerWarning}
        </div>
      )}

      {pickerWarning && (
        <div className="mb-6 rounded-2xl border border-border bg-bg-panel px-4 py-3 text-xs text-text-dim">
          <div>origin: {runtimeInfo.origin}</div>
          <div>url: {runtimeInfo.href}</div>
          <div>secure context: {runtimeInfo.secureContext}</div>
          <div>showDirectoryPicker: {runtimeInfo.directoryPicker}</div>
        </div>
      )}

      {actionMessage && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <RiErrorWarningLine className="mt-0.5 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {mounts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-20 text-center">
          <RiFolderAddLine size={40} className="text-text-dim" />
          <p className="font-heading text-lg text-text-muted">フォルダがまだありません</p>
          <p className="text-sm text-text-dim">
            画像フォルダを追加すると、一括で追加ページや再スキャンを使えるようになります。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mounts.map((mount) => {
            const progress = scanning[mount.id];

            return (
              <div key={mount.id} className="rounded-2xl border border-border bg-bg-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-heading text-base text-text-main">{mount.name}</h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-text-dim">
                      <span>{mount.imageCount !== undefined ? `${mount.imageCount}枚` : '未スキャン'}</span>
                      {mount.lastScannedAt && (
                        <span>
                          最終スキャン: {new Date(mount.lastScannedAt).toLocaleDateString('ja-JP')}
                        </span>
                      )}
                      <span>{mount.includeSubdirs ? 'サブフォルダを含む' : 'トップのみ'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!progress && (
                      <button
                        type="button"
                        onClick={() => void rescan(mount)}
                        className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-dim transition-colors hover:text-text-muted"
                      >
                        <RiRefreshLine size={14} />
                        再スキャン
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void removeMount(mount.id)}
                      disabled={Boolean(progress)}
                      className="rounded-xl border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-dim transition-colors hover:text-red-400 disabled:opacity-40"
                    >
                      <RiDeleteBin7Line size={14} />
                    </button>
                  </div>
                </div>

                {progress && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-text-dim">
                      <span>スキャン中...</span>
                      <span>
                        {progress.done} / {progress.total || '?'}
                        {progress.added > 0 && <span className="ml-2 text-accent">+{progress.added}</span>}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-bg-surface">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-200"
                        style={{
                          width:
                            progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                )}

                {!progress && mount.lastScannedAt && (
                  <div className="mt-3 flex items-center gap-1 text-xs text-green-500/70">
                    <RiCheckLine size={12} />
                    スキャン済み
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <section className="mt-8 rounded-2xl border border-orange-500/20 bg-bg-panel p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-orange-300/70">Maintenance</p>
            <h2 className="mt-1 font-heading text-lg text-text-main">見つからない画像</h2>
            <p className="mt-1 text-sm text-text-dim">
              フォルダ移動やリネームで見つからなくなった画像レコードを確認して削除できます。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-dim">{missingImages.length}件</span>
            <button
              type="button"
              onClick={() => void handleRemoveAllMissing()}
              disabled={missingImages.length === 0 || isCleaningMissing}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              すべて削除
            </button>
          </div>
        </div>

        {missingImages.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border/60 px-4 py-8 text-center text-sm text-text-dim">
            現在、見つからない画像はありません。
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {missingImages.map((image) => (
              <article
                key={image.id}
                className="grid gap-3 rounded-2xl border border-border bg-bg-surface/60 p-3 md:grid-cols-[84px_minmax(0,1fr)_auto]"
              >
                <div className="overflow-hidden rounded-xl bg-black/30">
                  {image.thumbnail ? (
                    <img
                      src={image.thumbnail}
                      alt={image.fileName}
                      className="aspect-square h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-xs text-text-dim">
                      No image
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm text-text-main">{image.fileName}</p>
                  <div className="mt-1 space-y-1 text-xs text-text-dim">
                    <div>マウント: {mountNameMap.get(image.mountId) ?? 'Unknown'}</div>
                    <div className="break-all">フォルダ: {image.folderPath || 'ルート'}</div>
                    <div className="break-all">パス: {image.relativePath}</div>
                    <div>
                      更新: {new Date(image.updatedAt ?? image.addedAt).toLocaleString('ja-JP')}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <button
                    type="button"
                    onClick={() => void handleRemoveMissing(image.id)}
                    disabled={isCleaningMissing}
                    className="rounded-xl border border-border bg-bg-panel px-3 py-2 text-xs text-text-dim transition-colors hover:text-red-400 disabled:opacity-40"
                  >
                    <RiDeleteBin7Line size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
