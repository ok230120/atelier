// FILE: src/pages/novels/components/NovelCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { RiHeart3Fill, RiHeart3Line, RiBookOpenLine } from 'react-icons/ri';
import type { Novel } from '../../../types/domain';
import { db } from '../../../db/schema';
import TagChip from '../../../components/TagChip';

interface NovelCardProps {
  novel: Novel;
}

const NovelCard: React.FC<NovelCardProps> = ({ novel }) => {
  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await db.novels.update(novel.id, { favorite: !novel.favorite });
  };

  // あらすじを3行に制限
  const summaryLines = novel.summary.split('\n').slice(0, 3);
  const summaryPreview = summaryLines.join('\n');
  const isSummaryTruncated = novel.summary.split('\n').length > 3 || summaryPreview.length > 150;

  return (
    <Link
      to={`/novels/${novel.id}/1`}
      className="block bg-bg-panel border border-border rounded-2xl overflow-hidden hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10 group"
    >
      <div className="flex h-full">
        {/* サムネイル（左側・固定幅） */}
        <div className="relative w-48 flex-shrink-0 bg-bg-surface overflow-hidden">
          {novel.thumbnail ? (
            <img
              src={novel.thumbnail}
              alt={novel.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <RiBookOpenLine className="text-6xl text-text-dim opacity-20" />
            </div>
          )}
        </div>

        {/* コンテンツ（右側） */}
        <div className="flex-1 p-5 flex flex-col min-w-0">
          {/* タイトルとお気に入り */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-heading text-lg font-semibold text-text-main line-clamp-2 flex-1 group-hover:text-accent transition-colors">
              {novel.title}
            </h3>
            <button
              onClick={handleToggleFavorite}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-bg-surface border border-border flex items-center justify-center hover:bg-bg hover:border-accent/50 transition-all"
            >
              {novel.favorite ? (
                <RiHeart3Fill className="text-lg text-red-400" />
              ) : (
                <RiHeart3Line className="text-lg text-text-muted" />
              )}
            </button>
          </div>

          {/* あらすじ */}
          <p className="font-body text-sm text-text-muted line-clamp-3 mb-4 flex-1">
            {summaryPreview}
            {isSummaryTruncated && '...'}
          </p>

          {/* 区切り線 */}
          <div className="border-t border-border mb-3"></div>

          {/* タグ */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {novel.tags.slice(0, 4).map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                size="sm"
                className="pointer-events-none"
              />
            ))}
            {novel.tags.length > 4 && (
              <span className="text-xs text-text-dim">+{novel.tags.length - 4}</span>
            )}
          </div>

          {/* 文字数とページ数 */}
          <div className="flex items-center gap-4 text-xs text-text-dim">
            <span>{novel.wordCount.toLocaleString()} characters</span>
            <span>·</span>
            <span>{novel.pageCount} {novel.pageCount === 1 ? 'page' : 'pages'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default NovelCard;