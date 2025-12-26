// FILE: src/pages/videos/components/TagDrawer.tsx
import React from 'react';
import classNames from 'classnames';
import { RiCloseLine, RiPriceTag3Line, RiCheckLine } from 'react-icons/ri';
import type { Video } from '../../../types/domain';
import { useTagRanking } from '../../../hooks/useTagRanking';

interface TagDrawerProps {
  open: boolean;
  onClose: () => void;
  videos: Video[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  tagSort?: 'popular' | 'alpha';
}

const TagDrawer: React.FC<TagDrawerProps> = ({
  open,
  onClose,
  videos,
  activeTags,
  onToggleTag,
  tagSort = 'popular',
}) => {
  const ranking = useTagRanking(videos, tagSort);

  return (
    <>
      {/* Backdrop */}
      <div
        className={classNames(
          'fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 z-40',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={classNames(
          'fixed top-0 right-0 h-full w-80 bg-bg-surface border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-border bg-bg-surface/95 backdrop-blur">
            <div className="flex items-center gap-2 text-text-main font-medium">
              <RiPriceTag3Line className="text-accent" />
              <span>Tags in View</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-text-dim hover:text-text-main hover:bg-bg-panel rounded-full transition-colors"
            >
              <RiCloseLine className="text-xl" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {ranking.length === 0 ? (
              <div className="text-center py-10 text-text-dim opacity-60">
                <p>No tags found in current list.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {ranking.map((tag) => {
                  const isActive = activeTags.includes(tag.name);
                  return (
                    <button
                      key={tag.name}
                      onClick={() => onToggleTag(tag.name)}
                      className={classNames(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group border',
                        isActive
                          ? 'bg-accent/10 border-accent/30 text-accent'
                          : 'bg-transparent border-transparent text-text-muted hover:bg-bg-panel hover:text-text-main',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={classNames(
                            'w-4 h-4 flex items-center justify-center rounded border transition-colors',
                            isActive ? 'bg-accent border-accent text-white' : 'border-text-dim',
                          )}
                        >
                          {isActive && <RiCheckLine className="text-[10px]" />}
                        </span>
                        <span className="truncate max-w-[160px]">#{tag.name}</span>
                      </div>
                      <span
                        className={classNames(
                          'text-xs px-1.5 py-0.5 rounded font-mono',
                          isActive ? 'bg-accent/20 text-accent' : 'bg-bg-panel text-text-dim',
                        )}
                      >
                        {tag.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-border/50 text-center">
              <p className="text-[10px] text-text-dim uppercase tracking-wider">
                Sort: {tagSort === 'popular' ? 'Count (Desc)' : 'Name (A-Z)'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TagDrawer;
