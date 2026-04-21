// FILE: src/components/ActiveFiltersBar.tsx
import React from "react";
import classNames from "classnames";
import {
  RiCloseLine,
  RiHardDriveLine,
  RiPriceTag3Line,
  RiRestartLine,
  RiSearchLine,
} from "react-icons/ri";
import { listControlCompactButtonClassName } from "./listControls";

type MountMini = { id: string; name: string; color?: string };

export interface ActiveFiltersBarProps {
  searchText: string;
  selectedTags: string[];
  mount: MountMini | null;
  currentPage: number;
  totalPages: number;

  onClearSearch: () => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
  onClearMount: () => void;
  onResetAll: () => void;
}

const Pill: React.FC<{
  icon?: React.ReactNode;
  label: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}> = ({ icon, label, onRemove, className }) => {
  return (
    <div
      className={classNames(
        "inline-flex items-center gap-2 rounded-xl border border-border bg-bg-panel px-3 py-1.5 text-xs text-text-main",
        className
      )}
    >
      {icon && <span className="text-text-dim">{icon}</span>}
      <span className="min-w-0 truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 inline-flex items-center justify-center rounded-lg p-1 text-text-dim hover:text-text-main hover:bg-bg-surface transition-colors"
          aria-label="フィルターを解除"
        >
          <RiCloseLine />
        </button>
      )}
    </div>
  );
};

const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
  searchText,
  selectedTags,
  mount,
  currentPage,
  totalPages,
  onClearSearch,
  onRemoveTag,
  onClearTags,
  onClearMount,
  onResetAll,
}) => {
  const hasAny =
    !!searchText.trim() || selectedTags.length > 0 || !!mount || currentPage > 1;

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchText.trim() && (
        <Pill
          icon={<RiSearchLine />}
          label={
            <span className="truncate">
              検索: <span className="text-text-dim">{searchText}</span>
            </span>
          }
          onRemove={onClearSearch}
        />
      )}

      {mount && (
        <Pill
          icon={
            <RiHardDriveLine
              className="text-text-dim"
              style={{ color: mount.color || undefined }}
            />
          }
          label={
            <span className="truncate">
              フォルダ: <span className="text-text-dim">{mount.name}</span>
            </span>
          }
          onRemove={onClearMount}
        />
      )}

      {selectedTags.length > 0 && (
        <Pill
          icon={<RiPriceTag3Line />}
          label={
            <span className="truncate">
              タグ:{" "}
              <span className="text-text-dim">{selectedTags.length}</span>
            </span>
          }
          onRemove={onClearTags}
        />
      )}

      {selectedTags.map((tag) => (
        <Pill
          key={tag}
          label={<span className="truncate">#{tag}</span>}
          onRemove={() => onRemoveTag(tag)}
          className="bg-bg-surface"
        />
      ))}

      {totalPages > 1 && (
        <Pill
          label={
            <span className="truncate">
              ページ:{" "}
              <span className="text-text-dim">
                {currentPage} / {totalPages}
              </span>
            </span>
          }
        />
      )}

      <button
        type="button"
        onClick={onResetAll}
        className={classNames("ml-auto", listControlCompactButtonClassName)}
      >
        <RiRestartLine />
        すべて解除
      </button>
    </div>
  );
};

export default ActiveFiltersBar;
