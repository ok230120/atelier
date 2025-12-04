import React from 'react';
import classNames from 'classnames';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  // Generate page numbers to show (simplified logic)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-2 rounded-lg text-text-dim hover:text-text-main hover:bg-bg-panel disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <RiArrowLeftSLine className="text-xl" />
      </button>

      {getPageNumbers().map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={classNames(
            "w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200",
            currentPage === page
              ? "bg-accent text-white shadow-glow"
              : "text-text-muted hover:bg-bg-panel hover:text-text-main"
          )}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg text-text-dim hover:text-text-main hover:bg-bg-panel disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <RiArrowRightSLine className="text-xl" />
      </button>
    </div>
  );
};

export default Pagination;