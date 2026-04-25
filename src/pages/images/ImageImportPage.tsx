import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine, RiCloseLine, RiFolderOpenLine, RiImageAddLine } from 'react-icons/ri';
import { useImageImportSession } from '../../hooks/useImageImportSession';
import ImageImportDestinationPicker from './components/ImageImportDestinationPicker';
import ImageImportDropzone from './components/ImageImportDropzone';
import ImageImportTagPicker from './components/ImageImportTagPicker';

function sourceLabel(sourceKind: 'picker-handle' | 'dropped-file' | 'clipboard-file') {
  return sourceKind === 'clipboard-file' ? '貼り付け' : 'ファイル';
}

export default function ImageImportPage() {
  const navigate = useNavigate();
  const session = useImageImportSession();

  const successCount = session.results.filter((result) => result.success).length;
  const failureResults = session.results.filter((result) => !result.success);
  const canSubmit =
    Boolean(session.selectedMount) && session.queuedItems.length > 0 && !session.isSaving;

  const openSavedFolderHref = useMemo(() => {
    if (!session.savedFolder) return null;
    const params = new URLSearchParams();
    params.set('mount', session.savedFolder.mountId);
    if (session.savedFolder.folderPath) params.set('folder', session.savedFolder.folderPath);
    params.set('scope', 'current');
    params.set('depth', 'direct');
    return `/images?${params.toString()}`;
  }, [session.savedFolder]);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/images')}
          className="text-text-dim transition-colors hover:text-text-main"
          aria-label="Back to images"
        >
          <RiArrowLeftLine size={20} />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-text-dim">Images / Import</p>
          <h1 className="font-heading text-2xl text-text-main">画像を取り込む</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/images/manage')}
          className="ml-auto rounded-xl border border-border bg-bg-panel px-3 py-2 text-sm text-text-muted transition-colors hover:text-text-main"
        >
          フォルダ管理
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <ImageImportDropzone
            onPickFiles={session.addFromPicker}
            onDropFiles={session.addFromDrop}
            onPasteEvent={session.addFromPaste}
            pickerWarning={session.pickerWarning}
          />

          <section className="rounded-2xl border border-border bg-bg-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg text-text-main">取り込みキュー</h2>
                <p className="mt-1 text-sm text-text-dim">
                  {session.queuedItems.length} 件の画像が取り込み待ちです。
                </p>
              </div>
              {session.queuedItems.length > 0 && (
                <button
                  type="button"
                  onClick={session.clearQueue}
                  className="text-sm text-text-dim transition-colors hover:text-text-main"
                >
                  すべて消す
                </button>
              )}
            </div>

            {session.queuedItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
                <RiImageAddLine size={36} className="mx-auto text-text-dim" />
                <p className="mt-3 text-sm text-text-dim">
                  画像を取り込むと、ここにファイル一覧が並びます。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {session.queuedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-bg-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-text-main">{item.fileName}</p>
                    </div>
                    <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted">
                      {sourceLabel(item.sourceKind)}
                    </span>
                    <button
                      type="button"
                      onClick={() => session.removeQueuedItem(item.id)}
                      className="text-text-dim transition-colors hover:text-red-400"
                      aria-label={`Remove ${item.fileName}`}
                    >
                      <RiCloseLine size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-bg-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-lg text-text-main">取り込みを実行</h2>
                <p className="mt-1 text-sm text-text-dim">
                  保存先とタグが決まったら、そのまま取り込めます。
                </p>
              </div>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void session.submitImport()}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {session.isSaving ? '取り込み中...' : `${session.queuedItems.length || 0}件を取り込む`}
              </button>
            </div>

            {session.errorMessage && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-200">
                {session.errorMessage}
              </div>
            )}

            {session.isSaving && (
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-sm text-text-dim">
                  <span>取り込み中</span>
                  <span>
                    {session.progress.done} / {session.progress.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg-surface">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-200"
                    style={{
                      width:
                        session.progress.total > 0
                          ? `${Math.round((session.progress.done / session.progress.total) * 100)}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>
            )}

            {session.results.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border bg-bg-surface px-4 py-3">
                  <p className="text-sm text-text-main">
                    成功 {successCount} 件 / 失敗 {failureResults.length} 件
                  </p>
                </div>

                {failureResults.length > 0 && (
                  <div className="rounded-xl border border-border bg-bg-surface px-4 py-3">
                    <p className="mb-2 text-sm text-text-main">失敗した項目</p>
                    <div className="space-y-2">
                      {failureResults.map((result) => (
                        <div key={result.itemId} className="text-sm text-text-dim">
                          <span className="text-text-main">{result.fileName}</span>
                          <span className="ml-2">{result.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {openSavedFolderHref && (
                  <button
                    type="button"
                    onClick={() => navigate(openSavedFolderHref)}
                    className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm text-text-main transition-colors hover:text-accent"
                  >
                    <RiFolderOpenLine size={16} />
                    保存先フォルダを開く
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <ImageImportDestinationPicker
            mounts={session.mounts}
            selectedMountId={session.selectedMountId}
            selectedFolderPath={session.selectedFolderPath}
            childFolders={session.childFolders}
            recentFolders={session.recentFolders}
            onAddMount={session.addMountFromDialog}
            onMountSelect={session.chooseMount}
            onChooseFolder={session.chooseFolder}
            onOpenChildFolder={session.openChildFolder}
            onCreateFolder={session.createSubfolder}
          />

          <ImageImportTagPicker
            categories={session.categories}
            allTags={session.allTags}
            selectedTagIds={session.selectedTagIds}
            recentTagIds={session.recentTagIds}
            onToggleTag={session.toggleTag}
            onCreateTag={session.createTag}
          />
        </div>
      </div>
    </div>
  );
}
