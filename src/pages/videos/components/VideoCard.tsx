import React from 'react';
import { Link } from 'react-router-dom';
import { RiPlayCircleFill, RiHeart3Line, RiHeart3Fill, RiMovieFill } from 'react-icons/ri';
import classNames from 'classnames';
import { Video } from '../../../types/domain';

interface VideoCardProps {
  video: Video;
  className?: string;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, className }) => {
  // Format duration (seconds -> MM:SS)
  const formatDuration = (sec?: number) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const displayName = video.titleOverride || video.filename;
  const durationStr = formatDuration(video.durationSec);

  return (
    <div className={classNames("group relative flex flex-col gap-2", className)}>
      <Link 
        to={`/video/${video.id}`}
        className="block relative aspect-video bg-bg-panel rounded-2xl overflow-hidden border border-border shadow-md 
                   transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl group-hover:border-accent/30 group-hover:z-10"
      >
        {video.thumbnail ? (
          <img 
            src={video.thumbnail} 
            alt={displayName} 
            className="w-full h-full object-cover transition-opacity duration-300 opacity-90 group-hover:opacity-100"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-text-dim bg-bg-surface/50">
            <RiMovieFill className="text-4xl opacity-20 mb-2" />
            <span className="text-xs font-mono opacity-40">NO THUMBNAIL</span>
          </div>
        )}

        {/* Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-90 group-hover:scale-100">
          <RiPlayCircleFill className="text-5xl text-white drop-shadow-lg" />
        </div>

        {/* Duration Badge */}
        {durationStr && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-bold rounded tracking-wider backdrop-blur-sm">
            {durationStr}
          </div>
        )}

        {/* Favorite Badge (Top Right) */}
        <div className="absolute top-2 right-2">
          {video.favorite ? (
            <div className="bg-black/60 p-1.5 rounded-full backdrop-blur-sm text-red-500">
              <RiHeart3Fill />
            </div>
          ) : (
            // Only show empty heart on hover if not favorite
            <div className="bg-black/60 p-1.5 rounded-full backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400">
              <RiHeart3Line />
            </div>
          )}
        </div>
      </Link>

      <div className="px-1">
        <div className="flex justify-between items-start gap-2">
          <Link to={`/video/${video.id}`} className="group-hover:text-accent transition-colors duration-200">
            <h3 className="font-heading font-medium text-sm leading-snug line-clamp-2 text-text-main" title={displayName}>
              {displayName}
            </h3>
          </Link>
        </div>
        
        {video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5 opacity-60 group-hover:opacity-90 transition-opacity">
            {video.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] text-text-dim">#{tag}</span>
            ))}
            {video.tags.length > 3 && (
              <span className="text-[10px] text-text-dim">+{video.tags.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCard;