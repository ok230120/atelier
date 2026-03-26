// FILE: src/pages/novels/components/NovelTagDrawer.tsx
import React, { useMemo } from 'react';
import { RiCloseLine, RiLoader4Line, RiPriceTag3Line } from 'react-icons/ri';
import TagChip from '../../../components/TagChip';

interface TagCount {
  tag: string;
  count: number;
}

interface NovelTagDrawerProps {
  open: boolean;
  onClose: () => void;
  ranking: TagCount[];
  rankingLoading: boolean;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  tagSort: 'popular' | 'alpha';
}

const NovelTagDrawer: React.FC<NovelTagDrawerProps> = ({
  open,
  onClose,
  ranking,
  rankingLoading,
  activeTags,
  onToggleTag,
  tagSort,
}) => {
  const sortedRanking = useMemo(() => {
    const sorted = [...ranking];
    if (tagSort === 'alpha') {
      sorted.sort((a, b) => a.tag.localeCompare(b.tag));
    } else {
      sorted.sort((a, b) => b.count - a.count);
    }
    return sorted;
  }, [ranking, tagSort]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-bg-panel border-l border-border shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <RiPriceTag3Line className="text-xl text-accent" />
            <h3 className="font-heading text-lg font-semibold">Filter by Tags</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-bg-surface text-text-muted hover:text-text-main transition-colors"
          >
            <RiCloseLine className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {rankingLoading ? (
            <div className="flex items-center justify-center py-12">
              <RiLoader4Line className="animate-spin text-3xl text-accent" />
            </div>
          ) : sortedRanking.length === 0 ? (
            <div className="text-center py-12 text-text-dim">
              <RiPriceTag3Line className="text-4xl mx-auto mb-3 opacity-20" />
              <p className="text-sm">No tags found</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {sortedRanking.map((item) => (
                <TagChip
                  key={item.tag}
                  label={`${item.tag} (${item.count})`}
                  isSelected={activeTags.includes(item.tag)}
                  onClick={() => onToggleTag(item.tag)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTags.length > 0 && (
          <div className="p-5 border-t border-border">
            <div className="text-xs text-text-dim mb-2">
              {activeTags.length} tag{activeTags.length !== 1 ? 's' : ''} selected
            </div>
            <div className="flex flex-wrap gap-2">
              {activeTags.map((tag) => (
                <TagChip
                  key={tag}
                  label={tag}
                  isSelected
                  onClick={() => onToggleTag(tag)}
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default NovelTagDrawer;