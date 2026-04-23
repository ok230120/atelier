import { useMemo, useState } from 'react';
import { RiAddLine, RiArrowRightSLine, RiFolderLine } from 'react-icons/ri';
import type { ImageMount } from '../../../types/domain';

type RecentFolder = {
  mountId: string;
  folderPath: string;
  usedAt: number;
};

type Props = {
  mounts: ImageMount[];
  selectedMountId: string;
  selectedFolderPath: string;
  childFolders: string[];
  recentFolders: RecentFolder[];
  onMountSelect: (mountId: string) => void;
  onChooseFolder: (folderPath: string) => void;
  onOpenChildFolder: (folderName: string) => void;
  onCreateFolder: (folderName: string) => Promise<void>;
};

function folderLabel(folderPath: string) {
  return folderPath || 'root';
}

export default function ImageImportDestinationPicker({
  mounts,
  selectedMountId,
  selectedFolderPath,
  childFolders,
  recentFolders,
  onMountSelect,
  onChooseFolder,
  onOpenChildFolder,
  onCreateFolder,
}: Props) {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedMount = mounts.find((mount) => mount.id === selectedMountId) ?? null;
  const recentEntries = useMemo(
    () =>
      recentFolders
        .map((entry) => ({
          ...entry,
          mount: mounts.find((mount) => mount.id === entry.mountId) ?? null,
        }))
        .filter((entry) => entry.mount),
    [mounts, recentFolders],
  );

  const breadcrumbs = useMemo(() => {
    const parts = selectedFolderPath ? selectedFolderPath.split('/') : [];
    const items = [{ label: 'root', folderPath: '' }];
    parts.forEach((part, index) => {
      items.push({
        label: part,
        folderPath: parts.slice(0, index + 1).join('/'),
      });
    });
    return items;
  }, [selectedFolderPath]);

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || isCreating) return;

    setIsCreating(true);
    try {
      await onCreateFolder(trimmed);
      setNewFolderName('');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-bg-panel p-5">
      <h2 className="font-heading text-lg text-text-main">保存先</h2>
      <p className="mt-1 text-sm text-text-dim">
        最近使った保存先を選ぶか、その場でフォルダを作って保存できます。
      </p>

      {recentEntries.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs text-text-dim">最近使った保存先</p>
          <div className="flex flex-wrap gap-2">
            {recentEntries.map((entry) => (
              <button
                key={`${entry.mountId}:${entry.folderPath}`}
                type="button"
                onClick={() => {
                  onMountSelect(entry.mountId);
                  onChooseFolder(entry.folderPath);
                }}
                className="rounded-full border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-muted transition-colors hover:text-text-main"
              >
                {entry.mount?.name} / {folderLabel(entry.folderPath)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {mounts.length > 1 && (
          <div>
            <p className="mb-2 text-xs text-text-dim">マウント</p>
            <select
              value={selectedMountId}
              onChange={(event) => onMountSelect(event.target.value)}
              className="w-full rounded-xl border border-border bg-bg-surface px-3 py-2 text-sm text-text-main outline-none"
            >
              <option value="">保存先を選択</option>
              {mounts.map((mount) => (
                <option key={mount.id} value={mount.id}>
                  {mount.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedMount && (
          <>
            <div>
              <p className="mb-2 text-xs text-text-dim">現在の場所</p>
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-bg-surface px-3 py-2">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.folderPath || 'root'} className="flex items-center gap-1">
                    {index > 0 && <RiArrowRightSLine className="text-text-dim" size={14} />}
                    <button
                      type="button"
                      onClick={() => onChooseFolder(crumb.folderPath)}
                      className="text-sm text-text-muted transition-colors hover:text-text-main"
                    >
                      {crumb.label}
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-accent">この場所に保存します: {folderLabel(selectedFolderPath)}</p>
            </div>

            <div>
              <p className="mb-2 text-xs text-text-dim">下位フォルダ</p>
              {childFolders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-text-dim">
                  ここにはまだ子フォルダがありません。
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {childFolders.map((folderName) => (
                    <button
                      key={folderName}
                      type="button"
                      onClick={() => onOpenChildFolder(folderName)}
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-3 py-2 text-sm text-text-muted transition-colors hover:text-text-main"
                    >
                      <RiFolderLine size={15} />
                      {folderName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs text-text-dim">新しいフォルダを作る</p>
              <div className="flex gap-2">
                <input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleCreateFolder();
                  }}
                  placeholder="現在の場所の下に作成"
                  className="flex-1 rounded-xl border border-border bg-bg-surface px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-dim"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  disabled={!newFolderName.trim() || isCreating}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-3 py-2 text-sm text-text-main transition-colors hover:text-accent disabled:opacity-50"
                >
                  <RiAddLine size={15} />
                  作成
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
