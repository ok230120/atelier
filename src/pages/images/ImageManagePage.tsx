import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiDeleteBin7Line,
  RiErrorWarningLine,
  RiFolderAddLine,
  RiImageAddLine,
  RiRefreshLine,
  RiPriceTag3Line,
} from 'react-icons/ri';
import { db } from '../../db/client';
import type { ImageMount } from '../../types/domain';
import { fileSystem } from '../../services/fileSystem';
import { listImageMounts, scanImageMount, type ScanProgress } from '../../services/imageService';

export default function ImageManagePage() {
  const navigate = useNavigate();
  const [mounts, setMounts] = useState<ImageMount[]>([]);
  const [scanning, setScanning] = useState<Record<string, ScanProgress>>({});
  const [isPicking, setIsPicking] = useState(false);
  const [pickerWarning, setPickerWarning] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const runtimeInfo = {
    origin: window.location.origin,
    href: window.location.href,
    secureContext: window.isSecureContext ? 'yes' : 'no',
    directoryPicker: typeof window.showDirectoryPicker === 'function' ? 'available' : 'missing',
  };

  const reload = async () => {
    setMounts(await listImageMounts());
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
    if (!window.confirm('このマウントと画像メタ情報を削除しますか？実ファイルは削除されません。')) {
      return;
    }

    await db.images.where('mountId').equals(mountId).delete();
    await db.imageMounts.delete(mountId);
    await reload();
  };

  return (
    <div className="relative mx-auto max-w-4xl p-6">
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
            画像フォルダを追加して、取り込みや再スキャンを行います。
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
            画像フォルダを追加すると、一覧と追加ページで使えるようになります。
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
                          width: progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : '0%',
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
    </div>
  );
}
