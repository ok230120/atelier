// FILE: src/pages/videos/components/VideoCard.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import { RiPlayCircleFill, RiMovieFill } from 'react-icons/ri';

import type { Video } from '../../../types/domain';
import { getVideoDisplayTitle } from '../../../utils/videoDisplay';
import FavoriteToggleButton from './FavoriteToggleButton';

interface VideoCardProps {
  video: Video;
  className?: string;
}

function formatDuration(sec?: number): string {
  if (sec == null) return '';
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, className }) => {
  const location = useLocation();

  const title = getVideoDisplayTitle(video);
  const durationStr = formatDuration(video.durationSec);

  // 一覧の ?tag=... 等を詳細にも引き継ぐ
  const toDetail = `/video/${video.id}${location.search}`;

  const tags = video.tags ?? [];

  return (
    <div className={classNames('group relative flex flex-col gap-2', className)}>
      <Link
        to={toDetail}
        className="block relative aspect-video bg-bg-panel rounded-2xl overflow-hidden border border-border shadow-md
                   transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl group-hover:border-accent/30 group-hover:z-10"
      >
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={title}
            className="w-full h-full object-cover transition-opacity duration-300 opacity-90 group-hover:opacity-100"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-dim bg-bg-surface/50">
            <RiMovieFill className="text-4xl opacity-20 mb-2" />
            <span className="text-xs font-mono opacity-40">NO THUMBNAIL</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
          <RiPlayCircleFill className="text-5xl text-white drop-shadow-lg" />
        </div>

        {durationStr && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-bold rounded tracking-wider backdrop-blur-sm">
            {durationStr}
          </div>
        )}

        {/* お気に入り（右上） */}
        <div className="absolute top-2 right-2">
          {/* ハート押下時に Link 遷移しないように止める */}
          <div
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <FavoriteToggleButton videoId={video.id} favorite={video.favorite} />
          </div>
        </div>
      </Link>

      <div className="px-1">
        {/* flexの中で長い1単語が折り返されない事故対策：Linkに min-w-0 */}
        <div className="flex items-start gap-2">
          <Link
            to={toDetail}
            className="block min-w-0 flex-1 group-hover:text-accent transition-colors duration-200"
            title={title}
          >
            <div
              className="
                font-heading font-medium text-sm leading-snug text-text-main
                min-w-0
                overflow-hidden
                whitespace-normal
                break-words
                [overflow-wrap:anywhere]
                [display:-webkit-box]
                [-webkit-line-clamp:2]
                [-webkit-box-orient:vertical]
                min-h-[2.5rem]
              "
            >
              {title}
            </div>
          </Link>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 opacity-60 group-hover:opacity-90 transition-opacity">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-text-dim">
                #{tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] text-text-dim">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCard;
