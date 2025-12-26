// FILE: src/components/TagPinnedRow.tsx
import React from 'react';
import TagChip from './TagChip';
import { RiPushpinLine } from 'react-icons/ri';

interface TagPinnedRowProps {
  pinnedTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
}

const TagPinnedRow: React.FC<TagPinnedRowProps> = ({ pinnedTags, selectedTags, onToggleTag }) => {
  if (pinnedTags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
      <div className="flex items-center gap-1 text-xs text-text-dim px-2 shrink-0 select-none">
        <RiPushpinLine />
        <span className="font-medium uppercase tracking-wider">Pinned</span>
      </div>

      {pinnedTags.map((tag) => (
        <TagChip
          key={tag}
          label={`#${tag}`}
          isSelected={selectedTags.includes(tag)}
          onClick={() => onToggleTag(tag)}
          size="sm"
          className="shrink-0"
        />
      ))}
    </div>
  );
};

export default TagPinnedRow;
