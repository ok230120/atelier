// FILE: src/pages/videos/components/DeleteVideoButton.tsx
import React from 'react';
import { RiDeleteBinLine } from 'react-icons/ri';
import { db } from '../../../db/client';

type Props = {
  videoId: string;
  className?: string;
  onDeleted?: () => void;
  confirmText?: string;
  stopPropagation?: boolean;
};

const DeleteVideoButton: React.FC<Props> = ({
  videoId,
  className,
  onDeleted,
  confirmText = 'この動画を削除しますか？（元ファイルは消しません）',
  stopPropagation = false,
}) => {
  const onClick = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    const ok = window.confirm(confirmText);
    if (!ok) return;

    await db.videos.delete(videoId);
    onDeleted?.();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? 'inline-flex items-center gap-2 rounded-xl border border-border bg-bg-panel px-3 py-2 text-sm hover:border-red-500/40 hover:text-red-300 transition-colors'}
      title="Delete"
    >
      <RiDeleteBinLine />
      <span className="hidden sm:inline">Delete</span>
    </button>
  );
};

export default DeleteVideoButton;
