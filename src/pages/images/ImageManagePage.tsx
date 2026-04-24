import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiArrowLeftLine,
  RiCheckLine,
  RiDeleteBin7Line,
  RiErrorWarningLine,
  RiFolderAddLine,
  RiFolderOpenLine,
  RiImageAddLine,
  RiRefreshLine,
  RiUploadCloud2Line,
} from 'react-icons/ri';
import type { ImageAppBuildInfo, ImageMount, ImageRecord } from '../../types/domain';
import { getAppBuildInfoDesktop } from '../../services/imageDesktopApi';
import {
  createImageMount,
  importLegacyImageData,
  listImageMounts,
  listMissingImages,
  pickImageMount,
  relinkImageMount,
  removeImageMount,
  removeMissingImages,
  scanImageMount,
  getImageStorageInfo,
  type ScanProgress,
} from '../../services/imageService';
import { exportLegacyImageData } from '../../services/legacyImageExport';
import { isTauriRuntime } from '../../services/tauri';

export default function ImageManagePage() {
  const navigate = useNavigate();
  const tauriRuntime = isTauriRuntime();
  const importInputRef = useRef<HTMLInputElement>(null);

  const [mounts, setMounts] = useState<ImageMount[]>([]);
  const [missingImages, setMissingImages] = useState<ImageRecord[]>([]);
  const [scanning, setScanning] = useState<Record<string, ScanProgress>>({});
  const [isPicking, setIsPicking] = useState(false);
  const [isCleaningMissing, setIsCleaningMissing] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<{ databaseLabel: string; cacheLabel: string } | null>(
    null,
  );
  const [buildInfo, setBuildInfo] = useState<ImageAppBuildInfo | null>(null);

  const mountNameMap = useMemo(
    () => new Map(mounts.map((mount) => [mount.id, mount.name])),
    [mounts],
  );

  const reload = async () => {
    const [nextMounts, nextMissingImages, nextStorageInfo, nextBuildInfo] = await Promise.all([
      listImageMounts(),
      listMissingImages(),
      getImageStorageInfo(),
      tauriRuntime ? getAppBuildInfoDesktop() : Promise.resolve(null),
    ]);
    setMounts(nextMounts);
    setMissingImages(nextMissingImages);
    setStorageInfo(nextStorageInfo);
    setBuildInfo(nextBuildInfo);
  };

  useEffect(() => {
    if (!tauriRuntime) {
      setMounts([]);
      setMissingImages([]);
      setStorageInfo(null);
      setBuildInfo(null);
      return;
    }
    void reload();
  }, [tauriRuntime]);

  const runScan = async (mountId: string) => {
    setScanning((prev) => ({ ...prev, [mountId]: { done: 0, total: 0, added: 0, skipped: 0 } }));
    try {
      const progress = await scanImageMount(mountId);
      setScanning((prev) => ({ ...prev, [mountId]: progress }));
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
      const basePath = await pickImageMount();
      if (!basePath) return;
      const mount = await createImageMount(basePath, true);
      await reload();
      await runScan(mount.id);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'フォルダの追加に失敗しました。');
    } finally {
      setIsPicking(false);
    }
  };

  const handleRelinkMount = async (mount: ImageMount) => {
    setActionMessage(null);

    try {
      const basePath = await pickImageMount();
      if (!basePath) return;
      const relinkedMount = await relinkImageMount(mount.id, basePath);
      await runScan(relinkedMount.id);
      setActionMessage(`「${mount.name}」のフォルダを再指定しました。`);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'フォルダの再指定に失敗しました。');
    }
  };

  const handleRemoveMount = async (mountId: string) => {
    if (!window.confirm('このフォルダ登録と画像メタ情報を削除します。元の画像ファイルは削除されません。')) {
      return;
    }

    await removeImageMount(mountId);
    await reload();
  };

  const handleRemoveMissing = async (imageId: string) => {
    if (!window.confirm('見つからない画像レコードを削除しますか？')) {
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

  const handleImportLegacyClick = () => {
    importInputRef.current?.click();
  };

  const handleImportLegacyFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await importLegacyImageData(await file.text());
      setActionMessage(
        `旧データを取り込みました。画像 ${result.importedImages} 件 / タグ ${result.importedTags} 件 / 対応 schemaVersion ${buildInfo?.legacyImageSchemaVersion ?? 1}。バックアップ: ${result.backupPath}`,
      );
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : '旧データの取り込みに失敗しました。';
      if (message.includes('Unsupported legacy image schemaVersion')) {
        setActionMessage(
          `この JSON は現在の Tauri 版が対応していない schemaVersion です。実行中の Tauri 版が古い可能性があります。最新ビルドを起動し直してください。詳細: ${message}`,
        );
      } else if (message.includes('Unsupported legacy image export format')) {
        setActionMessage(
          `この JSON は画像救出 JSON として認識できません。旧ブラウザ版の「画像データを書き出す」で作成した JSON を選択してください。詳細: ${message}`,
        );
      } else if (message.includes('expected') || message.includes('parse')) {
        setActionMessage(
          `JSON の読み込みに失敗しました。JSON が壊れているか、別形式のファイルを選択した可能性があります。詳細: ${message}`,
        );
      } else {
        setActionMessage(`旧データの取り込みに失敗しました。詳細: ${message}`);
      }
    } finally {
      event.target.value = '';
    }
  };

  const handleExportLegacyData = async () => {
    setActionMessage(null);

    try {
      await exportLegacyImageData();
      setActionMessage('画像データを書き出しました。Tauri 版の「旧データを取り込む」から取り込んでください。');
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '画像データの書き出しに失敗しました。');
    }
  };

  return (
    <div className="relative mx-auto max-w-5xl p-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => void handleImportLegacyFile(event)}
      />

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
          <h1 className="font-heading text-2xl text-text-main">画像管理</h1>
          <p className="mt-0.5 text-sm text-text-dim">
            画像ライブラリのフォルダ管理と旧データ移行を行います。
          </p>
        </div>

        {tauriRuntime && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/images/import')}
              className="flex items-center gap-2 rounded-xl border border-border bg-bg-panel px-4 py-2.5 text-sm text-text-main transition-colors hover:text-accent"
            >
              <RiImageAddLine size={16} />
              画像を取り込む
            </button>
            <button
              type="button"
              onClick={handleImportLegacyClick}
              className="flex items-center gap-2 rounded-xl border border-border bg-bg-panel px-4 py-2.5 text-sm text-text-main transition-colors hover:text-accent"
            >
              <RiUploadCloud2Line size={16} />
              旧データを取り込む
            </button>
            <button
              type="button"
              onClick={() => void addMount()}
              disabled={isPicking}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RiFolderAddLine size={16} />
              {isPicking ? 'フォルダ選択中...' : 'フォルダを追加'}
            </button>
          </div>
        )}
      </div>

      {!tauriRuntime && (
        <section className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-orange-300/80">Image Rescue</p>
          <h2 className="mt-2 font-heading text-xl text-text-main">旧ブラウザ版ではここが画像救出ページです</h2>
          <p className="mt-2 text-sm text-text-dim">
            ここから画像フォルダ・タグ・カテゴリ・最近使ったフォルダ/タグを救出 JSON として書き出します。画像本体は含みません。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleExportLegacyData()}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm text-white transition-colors hover:bg-blue-500"
            >
              画像データを書き出す
            </button>
            <button
              type="button"
              onClick={() => navigate('/images')}
              className="rounded-xl border border-border bg-bg-panel px-4 py-2.5 text-sm text-text-main transition-colors hover:text-accent"
            >
              画像一覧へ戻る
            </button>
          </div>
          {actionMessage && (
            <div className="mt-4 rounded-2xl border border-orange-500/20 bg-bg-panel px-4 py-3 text-sm text-text-main">
              {actionMessage}
            </div>
          )}
        </section>
      )}

      {tauriRuntime && storageInfo && (
        <div className="mb-6 rounded-2xl border border-border bg-bg-panel px-4 py-3 text-xs text-text-dim">
          <div>DB: {storageInfo.databaseLabel}</div>
          <div>Cache: {storageInfo.cacheLabel}</div>
        </div>
      )}

      {tauriRuntime && (
        <section className="mb-6 rounded-2xl border border-border bg-bg-panel p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-text-dim">Legacy Import</p>
          <h2 className="mt-1 font-heading text-lg text-text-main">旧データを取り込む前の確認</h2>
          <div className="mt-3 space-y-1 text-sm text-text-dim">
            <p>この画面は最新の Tauri ビルドで開いてください。</p>
            <p>旧ブラウザ版で書き出した `atelier-legacy-images-*.json` を選択してください。</p>
          </div>
          {buildInfo && (
            <div className="mt-4 rounded-xl border border-border bg-bg-surface/60 px-4 py-3 text-xs text-text-dim">
              <div>App Version: {buildInfo.appVersion}</div>
              <div>
                Build Timestamp: {new Date(Number(buildInfo.buildTimestamp) * 1000).toLocaleString('ja-JP')}
              </div>
              <div>Supported Import Schema: {buildInfo.legacyImageSchemaVersion}</div>
            </div>
          )}
        </section>
      )}

      {tauriRuntime && actionMessage && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <RiErrorWarningLine className="mt-0.5 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {tauriRuntime &&
        (mounts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 py-20 text-center">
            <RiFolderAddLine size={40} className="text-text-dim" />
            <p className="font-heading text-lg text-text-muted">画像フォルダがまだありません</p>
            <p className="text-sm text-text-dim">最初にフォルダを追加してスキャンしてください。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mounts.map((mount) => {
              const progress = scanning[mount.id];
              const isMissingMount = mount.isAvailable === false;

              return (
                <div key={mount.id} className="rounded-2xl border border-border bg-bg-panel p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-heading text-base text-text-main">{mount.name}</h2>
                        {isMissingMount && (
                          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[11px] text-orange-200">
                            見つからないフォルダ
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-text-dim">
                        <span>{mount.imageCount !== undefined ? `${mount.imageCount} 件` : '未スキャン'}</span>
                        {mount.lastScannedAt && (
                          <span>最終スキャン: {new Date(mount.lastScannedAt).toLocaleString('ja-JP')}</span>
                        )}
                        {mount.basePath && <span className="break-all">{mount.basePath}</span>}
                        {isMissingMount && <span>{mount.missingImageCount ?? 0} 件が再リンク待ちです</span>}
                      </div>
                      {isMissingMount && (
                        <p className="mt-2 text-xs text-orange-200/90">
                          保存先パスが見つからないため再指定が必要です。再指定後に再スキャンします。
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {!progress && !isMissingMount && (
                        <button
                          type="button"
                          onClick={() => void runScan(mount.id)}
                          className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-dim transition-colors hover:text-text-muted"
                        >
                          <RiRefreshLine size={14} />
                          再スキャン
                        </button>
                      )}

                      {!progress && isMissingMount && (
                        <button
                          type="button"
                          onClick={() => void handleRelinkMount(mount)}
                          className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs text-orange-200 transition-colors hover:bg-orange-500/15"
                        >
                          <RiFolderOpenLine size={14} />
                          フォルダを再指定
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void handleRemoveMount(mount.id)}
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
                              progress.total > 0
                                ? `${Math.round((progress.done / progress.total) * 100)}%`
                                : '0%',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {!progress && mount.lastScannedAt && !isMissingMount && (
                    <div className="mt-3 flex items-center gap-1 text-xs text-green-500/70">
                      <RiCheckLine size={12} />
                      スキャン済み
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

      {tauriRuntime && (
        <section className="mt-8 rounded-2xl border border-orange-500/20 bg-bg-panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-orange-300/70">Maintenance</p>
              <h2 className="mt-1 font-heading text-lg text-text-main">見つからない画像</h2>
              <p className="mt-1 text-sm text-text-dim">
                ライブラリから消えた画像レコードを確認して削除できます。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-dim">{missingImages.length} 件</span>
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
                  className="grid gap-3 rounded-2xl border border-border bg-bg-surface/60 p-3 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-text-main">{image.fileName}</p>
                    <p className="mt-1 text-xs text-text-dim">
                      {mountNameMap.get(image.mountId) ?? 'Unknown'} / {image.folderPath || 'root'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveMissing(image.id)}
                    className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 transition-colors hover:bg-red-500/15"
                  >
                    削除
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
