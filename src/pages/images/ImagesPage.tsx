import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RiAddLine,
  RiArrowRightSLine,
  RiCheckboxMultipleLine,
  RiCloseLine,
  RiFolderLine,
  RiGridLine,
  RiHomeLine,
  RiPriceTag3Line,
  RiRefreshLine,
  RiSettings3Line,
} from 'react-icons/ri';
import Pagination from '../../components/Pagination';
import { useImageListUrlState } from '../../hooks/useImageListUrlState';
import {
  addTagsToImages,
  getBulkRemovableTags,
  getSubfolders,
  listImageMounts,
  listImageTags,
  queryImages,
  removeTagsFromImages,
  rescanAllImageMounts,
} from '../../services/imageService';
import type { ImageMount, ImageRecord, ImageTagRecord } from '../../types/domain';
import TagSelectorPanel from './components/TagSelectorPanel';

const PER_PAGE = 48;

function ImageCard({
  image,
  selected,
  selectMode,
  onSelect,
  onOpen,
}: {
  image: ImageRecord;
  selected: boolean;
  selectMode: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={selectMode ? onSelect : onOpen}
      className={
        selected
          ? 'group relative overflow-hidden rounded-xl border border-accent bg-bg-panel text-left shadow-[0_0_0_2px_rgba(59,130,246,0.35)] transition-all duration-200 hover:scale-[1.02]'
          : 'group relative overflow-hidden rounded-xl border border-border bg-bg-panel text-left transition-all duration-200 hover:scale-[1.02] hover:border-border-light'
      }
    >
      <div className="aspect-square overflow-hidden bg-bg-surface">
        {image.thumbnail ? (
          <img
            src={image.thumbnail}
            alt={image.fileName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-text-dim">
            <RiGridLine size={30} />
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />

      {(selectMode || selected) && (
        <div className="absolute left-2 top-2">
          <div
            className={
              selected
                ? 'flex h-5 w-5 items-center justify-center rounded-md border-2 border-accent bg-accent text-xs text-white'
                : 'flex h-5 w-5 items-center justify-center rounded-md border-2 border-white/60 bg-black/40'
            }
          >
            {selected ? '✓' : null}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-xs text-white/90">{image.fileName}</p>
      </div>
    </button>
  );
}

function BulkActionBar({
  count,
  onAddTags,
  onRemoveTags,
  onClear,
}: {
  count: number;
  onAddTags: () => void;
  onRemoveTags: () => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-border bg-bg-panel px-5 py-3 shadow-2xl">
      <span className="text-sm text-text-muted">{count}枚 選択中</span>
      <div className="h-5 w-px bg-border" />
      <button
        onClick={onAddTags}
        className="flex items-center gap-1.5 text-sm text-text-main transition-colors hover:text-accent"
      >
        <RiPriceTag3Line size={16} />
        タグを追加
      </button>
      <button
        onClick={onRemoveTags}
        className="text-sm text-text-muted transition-colors hover:text-red-400"
      >
        タグを削除
      </button>
      <button
        onClick={onClear}
        className="flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text-main"
      >
        <RiCloseLine size={16} />
        解除
      </button>
    </div>
  );
}

export default function ImagesPage() {
  const navigate = useNavigate();
  const list = useImageListUrlState();

  const [allImages, setAllImages] = useState<ImageRecord[]>([]);
  const [mounts, setMounts] = useState<ImageMount[]>([]);
  const [allTags, setAllTags] = useState<ImageTagRecord[]>([]);
  const [subfolders, setSubfolders] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagPanelMode, setTagPanelMode] = useState<'add' | 'remove' | null>(null);
  const [removableTags, setRemovableTags] = useState<ImageTagRecord[]>([]);
  const [isRescanning, setIsRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);
  const [failedMountsSummary, setFailedMountsSummary] = useState<string | null>(null);

  const refreshMeta = async () => {
    const [nextMounts, nextTags] = await Promise.all([listImageMounts(), listImageTags()]);
    setMounts(nextMounts);
    setAllTags(nextTags);
  };

  const refreshImages = async () => {
    const images = await queryImages({
      mountId: list.mountId || undefined,
      folder: list.folder || undefined,
      tagIds: list.selectedTagIds,
      scope: list.scope,
      folderDepth: list.folderDepth,
    });
    setAllImages(images);
    return images;
  };

  const refreshSubfolders = async () => {
    const folders = await getSubfolders(list.mountId || null, list.folder);
    setSubfolders(folders);
    return folders;
  };

  useEffect(() => {
    void refreshMeta();
  }, []);

  useEffect(() => {
    void refreshImages();
  }, [list.folder, list.folderDepth, list.mountId, list.scope, list.selectedTagIds]);

  useEffect(() => {
    void refreshSubfolders();
  }, [list.folder, list.mountId]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [list.folder, list.folderDepth, list.mountId, list.scope, list.selectedTagIds]);

  const totalPages = Math.max(1, Math.ceil(allImages.length / PER_PAGE));
  const safePage = Math.min(list.page, totalPages);
  const pageImages = useMemo(
    () => allImages.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
    [allImages, safePage],
  );

  useEffect(() => {
    if (list.page !== safePage) list.setPage(safePage);
  }, [list, safePage]);

  const selectedMount = mounts.find((mount) => mount.id === list.mountId);
  const fallbackMountId = !list.mountId && mounts.length === 1 ? mounts[0].id : list.mountId;
  const activeTagObjects = allTags.filter((tag) => list.selectedTagIds.includes(tag.id));

  const breadcrumbs = useMemo(() => {
    const items: Array<{ label: string; mountId: string; folder: string }> = [];

    if (!list.mountId) return items;
    items.push({ label: selectedMount?.name ?? 'Unknown', mountId: list.mountId, folder: '' });

    if (!list.folder) return items;

    const parts = list.folder.split('/');
    for (let index = 0; index < parts.length; index += 1) {
      items.push({
        label: parts[index],
        mountId: list.mountId,
        folder: parts.slice(0, index + 1).join('/'),
      });
    }

    return items;
  }, [list.folder, list.mountId, selectedMount?.name]);

  const selectedIdList = useMemo(() => Array.from(selectedIds), [selectedIds]);

  const toggleFilterTag = (tagId: string) => {
    list.setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleBulkAdd = async (tag: ImageTagRecord) => {
    await addTagsToImages(selectedIdList, [tag.id]);
    setTagPanelMode(null);
    await Promise.all([refreshImages(), refreshMeta()]);
  };

  const handleBulkRemoveOpen = async () => {
    setRemovableTags(await getBulkRemovableTags(selectedIdList));
    setTagPanelMode('remove');
  };

  const handleBulkRemove = async (tag: ImageTagRecord) => {
    await removeTagsFromImages(selectedIdList, [tag.id]);
    setTagPanelMode(null);
    await Promise.all([refreshImages(), refreshMeta()]);
  };

  const handleFilterTagAdded = async (tag: ImageTagRecord) => {
    await refreshMeta();
    list.setSelectedTagIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
    setTagPanelMode(null);
  };

  const handleRescan = async () => {
    if (isRescanning) return;

    setIsRescanning(true);
    setRescanMessage('画像一覧を更新中です');
    setFailedMountsSummary(null);

    try {
      const summary = await rescanAllImageMounts();
      await Promise.all([refreshMeta(), refreshImages(), refreshSubfolders()]);

      if (summary.failedMounts.length > 0) {
        setFailedMountsSummary('一部のフォルダを再スキャンできませんでした');
      }

      if (summary.scannedMountCount > 0) {
        setRescanMessage('画像一覧を更新しました');
      } else {
        setRescanMessage('再スキャンできるフォルダがありません');
      }
    } catch {
      setRescanMessage(null);
      setFailedMountsSummary('再スキャンに失敗しました');
    } finally {
      setIsRescanning(false);
    }
  };

  const resultSummary = (() => {
    if (list.scope === 'current') {
      if (list.folder) {
        return list.folderDepth === 'tree'
          ? '現在のフォルダ配下を表示中'
          : '現在のフォルダ直下を表示中';
      }
      if (selectedMount) {
        return list.folderDepth === 'tree'
          ? `${selectedMount.name} 配下を表示中`
          : `${selectedMount.name} 直下を表示中`;
      }
    }
    return '全画像を表示中';
  })();

  return (
    <div className="min-h-full p-6">
      <nav className="mb-5 flex items-center gap-1">
        <button
          onClick={list.goHome}
          className="text-sm text-text-dim transition-colors hover:text-text-muted"
          aria-label="Go to image home"
        >
          <RiHomeLine size={16} className="inline -mt-0.5" />
        </button>

        {breadcrumbs.map((crumb, index) => (
          <div key={`${crumb.mountId}:${crumb.folder}`} className="flex items-center gap-1">
            <RiArrowRightSLine className="text-text-dim" size={16} />
            <button
              onClick={() => list.navigateTo(crumb.mountId, crumb.folder)}
              className={
                index === breadcrumbs.length - 1
                  ? 'cursor-default text-sm text-text-main'
                  : 'text-sm text-text-dim transition-colors hover:text-text-muted'
              }
            >
              {crumb.label}
            </button>
          </div>
        ))}

        <button
          onClick={() => navigate('/images/import')}
          className="ml-auto flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-text-muted"
        >
          <RiAddLine size={14} />
          追加
        </button>

        <button
          onClick={() => void handleRescan()}
          disabled={isRescanning}
          className="flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-text-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RiRefreshLine size={14} />
          {isRescanning ? '再スキャン中...' : '再スキャン'}
        </button>

        <button
          onClick={() => navigate('/images/manage')}
          className="flex items-center gap-1.5 text-xs text-text-dim transition-colors hover:text-text-muted"
        >
          <RiSettings3Line size={14} />
          フォルダ管理
        </button>
      </nav>

      <div className="mb-5 rounded-2xl border border-border bg-bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          {activeTagObjects.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-sm text-accent"
            >
              {tag.name}
              <button
                onClick={() => toggleFilterTag(tag.id)}
                className="transition-colors hover:text-white"
              >
                <RiCloseLine size={14} />
              </button>
            </span>
          ))}

          <button
            onClick={() => setTagPanelMode('add')}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-sm text-text-dim transition-all hover:border-accent/40 hover:text-accent"
          >
            <RiPriceTag3Line size={14} />
            {list.selectedTagIds.length === 0 ? 'タグで絞り込む' : 'タグを追加'}
          </button>

          {list.selectedTagIds.length > 0 && (
            <button
              onClick={() => list.setSelectedTagIds([])}
              className="text-xs text-text-dim transition-colors hover:text-text-muted"
            >
              すべて解除
            </button>
          )}

          {(list.mountId || list.folder) && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-full border border-border bg-bg-surface p-0.5">
                {(['all', 'current'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => list.setScope(scope)}
                    className={
                      list.scope === scope
                        ? 'rounded-full bg-accent px-3 py-1 text-xs text-white'
                        : 'rounded-full px-3 py-1 text-xs text-text-dim transition-colors hover:text-text-muted'
                    }
                  >
                    {scope === 'all' ? 'すべて' : 'このフォルダ'}
                  </button>
                ))}
              </div>

              {list.scope === 'current' && (
                <div className="flex items-center rounded-full border border-border bg-bg-surface p-0.5">
                  {([
                    { key: 'direct', label: 'このフォルダのみ' },
                    { key: 'tree', label: '配下階層も表示' },
                  ] as const).map((option) => (
                    <button
                      key={option.key}
                      onClick={() => list.setFolderDepth(option.key)}
                      className={
                        list.folderDepth === option.key
                          ? 'rounded-full bg-accent px-3 py-1 text-xs text-white'
                          : 'rounded-full px-3 py-1 text-xs text-text-dim transition-colors hover:text-text-muted'
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-text-dim">
            {allImages.length.toLocaleString()}枚
            {list.selectedTagIds.length > 0 ? ' (絞り込み中)' : ''}
          </p>
          <p className="mt-1 text-xs text-text-dim">{resultSummary}</p>
          {rescanMessage && <p className="mt-1 text-xs text-text-dim">{rescanMessage}</p>}
          {failedMountsSummary && (
            <p className="mt-1 text-xs text-orange-300/80">{failedMountsSummary}</p>
          )}
        </div>
        <button
          onClick={() => {
            setSelectMode((prev) => !prev);
            if (selectMode) setSelectedIds(new Set());
          }}
          className={
            selectMode
              ? 'flex items-center gap-1.5 text-sm text-accent'
              : 'flex items-center gap-1.5 text-sm text-text-dim transition-colors hover:text-text-muted'
          }
        >
          <RiCheckboxMultipleLine size={16} />
          {selectMode ? '選択中' : '複数選択'}
        </button>
      </div>

      {!list.mountId && mounts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {mounts.map((mount) => (
            <button
              key={mount.id}
              onClick={() => list.navigateTo(mount.id, '')}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-panel px-3 py-2 text-sm text-text-muted transition-all hover:border-border-light hover:text-text-main"
            >
              <RiFolderLine size={15} />
              {mount.name}
              {mount.imageCount !== undefined && (
                <span className="text-xs text-text-dim">({mount.imageCount})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {subfolders.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {subfolders.map((subfolder) => (
            <button
              key={subfolder}
              onClick={() =>
                list.navigateTo(
                  fallbackMountId,
                  list.folder ? `${list.folder}/${subfolder}` : subfolder,
                )
              }
              className="flex items-center gap-1.5 rounded-xl border border-border bg-bg-panel px-3 py-2 text-sm text-text-muted transition-all hover:border-border-light hover:text-text-main"
            >
              <RiFolderLine size={15} />
              {subfolder}
            </button>
          ))}
        </div>
      )}

      {allImages.length === 0 && mounts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <RiGridLine size={48} className="text-text-dim" />
          <p className="font-heading text-xl text-text-muted">画像がまだありません</p>
          <p className="text-sm text-text-dim">
            フォルダを追加して画像を取り込んでください
          </p>
          <button
            onClick={() => navigate('/images/manage')}
            className="mt-2 rounded-xl bg-accent px-5 py-2.5 text-sm text-white transition-colors hover:bg-blue-500"
          >
            フォルダを追加する
          </button>
        </div>
      )}

      {allImages.length === 0 && mounts.length > 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 py-20 text-center">
          <RiGridLine size={40} className="text-text-dim" />
          <p className="font-heading text-lg text-text-muted">一致する画像がありません</p>
          <p className="text-sm text-text-dim">
            タグやフォルダ条件を見直すと見つけやすくなります
          </p>
        </div>
      )}

      {pageImages.length > 0 && (
        <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {pageImages.map((image) => (
            <ImageCard
              key={image.id}
              image={image}
              selected={selectedIds.has(image.id)}
              selectMode={selectMode}
              onSelect={() =>
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(image.id)) next.delete(image.id);
                  else next.add(image.id);
                  return next;
                })
              }
              onOpen={() => navigate(`/images/view/${image.id}`)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mb-16">
          <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={list.setPage} />
        </div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onAddTags={() => setTagPanelMode('add')}
          onRemoveTags={() => void handleBulkRemoveOpen()}
          onClear={() => {
            setSelectedIds(new Set());
            setSelectMode(false);
          }}
        />
      )}

      {tagPanelMode && (
        <TagSelectorPanel
          mode={tagPanelMode}
          title={
            tagPanelMode === 'add'
              ? selectMode && selectedIds.size > 0
                ? '選択画像にタグを追加'
                : 'タグで絞り込む'
              : '選択画像からタグを外す'
          }
          currentTagIds={selectMode && selectedIds.size > 0 ? [] : list.selectedTagIds}
          availableTagIds={
            tagPanelMode === 'remove' ? removableTags.map((tag) => tag.id) : undefined
          }
          onSelect={
            selectMode && selectedIds.size > 0
              ? tagPanelMode === 'add'
                ? handleBulkAdd
                : handleBulkRemove
              : handleFilterTagAdded
          }
          onClose={() => setTagPanelMode(null)}
        />
      )}
    </div>
  );
}
