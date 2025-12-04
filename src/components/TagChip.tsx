import React from 'react';
import classNames from 'classnames';
import { RiCloseLine } from 'react-icons/ri';

interface TagChipProps {
  label: string;
  isSelected?: boolean;
  onClick?: () => void;
  onRemove?: (e: React.MouseEvent) => void;
  className?: string;
  size?: 'sm' | 'md';
}

const TagChip: React.FC<TagChipProps> = ({ 
  label, 
  isSelected = false, 
  onClick, 
  onRemove,
  className,
  size = 'md'
}) => {
  return (
    <button
      onClick={onClick}
      className={classNames(
        "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 border select-none",
        // Sizes
        size === 'sm' ? "text-xs px-2.5 py-0.5" : "text-sm px-3 py-1",
        // Colors
        isSelected
          ? "bg-accent/20 text-accent-light border-accent/30 hover:bg-accent/30 shadow-[0_0_10px_-3px_rgba(59,130,246,0.4)]"
          : "bg-bg-panel text-text-muted border-border hover:border-text-dim hover:text-text-main",
        className
      )}
    >
      <span className="truncate max-w-[150px]">{label}</span>
      {onRemove && (
        <span 
          role="button" 
          onClick={onRemove}
          className="ml-1.5 -mr-1 p-0.5 rounded-full hover:bg-black/20 text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <RiCloseLine />
        </span>
      )}
    </button>
  );
};

export default TagChip;