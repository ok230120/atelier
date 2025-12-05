// FILE: src/pages/videos/VideoDetailPage.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import classNames from 'classnames';
import {
  RiArrowLeftLine,
  RiErrorWarningLine,
  RiHeart3Fill,
  RiHeart3Line,
  RiLoader4Line,
  RiMovieFill,
  RiSpeedLine,
} from 'react-icons/ri';

import { db } from '../../db/client';
import { fileSystem } from '../../services/fileSystem';
import ThumbnailActions from './components/ThumbnailActions';

const VideoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);

  // Dexie から動画メタデータを取得
  const video = useLiveQuery(async () => {
    if (!id) return null;
    return await db.videos.get(id);
  }, [id]);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // 動画ファイルのURLを準備（Blob URL など）
  useEffect(() => {
    let objectUrl: string | null = null;

    setLoadError(null);
    setPermissionNeeded(false);
    setVideoSrc(null);

    const loadSource = async () => {
      if (!video) return;

      try {
        if (video.pathKind === 'handle' && video.fileHandle) {
          // FileSystemFileHandle の権限をチェック
          const hasPerm = await fileSystem.verifyPermission(video.fileHandle, 'read');
          if (!hasPerm) {
            setPermissionNeeded(true);
            return;
          }

          const file = await video.fileHandle.getFile();
          objectUrl = URL.createObjectURL(file);
          setVideoSrc(objectUrl);
        } else if (video.pathKind === 'url' && video.url) {
          setVideoSrc(video.url);
        } else {
          setLoadError('Video path or handle is missing.');
        }
      } catch (err: any) {
        console.error('Error loading video source:', err);
        setLoadError(err?.message || 'Failed to load video file.');
      }
    };

    if (video) {
      loadSource();
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [video]);

  const handleRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const toggleFavorite = async () => {
    if (!video) return;
    await db.videos.update(video.id, { favorite: !video.favorite });
  };

  const handleThumbnailChange = async (dataUrl: string | null) => {
    if (!video) return;
    // TODO: thumbStore === "folder" のときはファイル保存に切り替える
    await db.videos.update(video.id, { thumbnail: dataUrl || undefined });
  };

  const requestPermission = async () => {
    if (!video?.fileHandle) return;

    try {
      const result = await video.fileHandle.requestPermission({ mode: 'read' });
      if (result === 'granted') {
        setPermissionNeeded(false);
        const file = await video.fileHandle.getFile();
        const url = URL.createObjectURL(file);
        setVideoSrc(url);
      }
    } catch (err) {
      console.error('Permission request failed:', err);
    }
  };

  // useLiveQuery の「まだ読み込み中」の状態
  if (id && video === undefined) {
    return (
      <div className="h-full flex items-center justify-center text-accent">
        <RiLoader4Line className="animate-spin text-4xl" />
      </div>
    );
  }

  // 見つからなかった
  if (!video) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-dim">
        <RiErrorWarningLine className="text-5xl mb-4 opacity-50" />
        <h2 className="text-xl font-medium">Video not found</h2>
        <Link to="/videos" className="mt-4 text-accent hover:underline">
          Return to Library
        </Link>
      </div>
    );
  }

  const hasTitle = !!video.titleOverride;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Mini Bar */}
      <div className="h-12 border-b border-border bg-bg-surface flex items-center justify-between px-6 flex-shrink-0 z-10">
        <Link
          to="/videos"
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition-colors"
        >
          <RiArrowLeftLine />
          <span>Library</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* Playback Speed */}
          <div className="flex items-center gap-2 text-xs bg-bg-panel rounded-full px-1 py-0.5 border border-border">
            <RiSpeedLine className="ml-2 text-text-dim" />
            {[1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                onClick={() => handleRateChange(rate)}
                className={classNames(
                  'px-2 py-0.5 rounded-full transition-colors',
                  playbackRate === rate
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-text-main',
                )}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Favorite Toggle */}
          <button
            onClick={toggleFavorite}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
              video.favorite
                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                : 'bg-bg-panel text-text-muted border-border hover:border-text-dim hover:text-text-main',
            )}
          >
            {video.favorite ? <RiHeart3Fill /> : <RiHeart3Line />}
            <span>{video.favorite ? 'Favorited' : 'Favorite'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-y-auto lg:overflow-hidden flex-col lg:flex-row">
        {/* Left: Video Player */}
        <div className="flex-1 bg-black flex items-center justify-center relative min-h-[300px] lg:h-full">
          {permissionNeeded ? (
            <div className="text-center p-8">
              <p className="text-text-main mb-4">
                Permission required to play this file.
              </p>
              <button
                onClick={requestPermission}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
              >
                Grant Permission
              </button>
            </div>
          ) : loadError ? (
            <div className="text-center text-red-400 p-8">
              <RiErrorWarningLine className="text-4xl mx-auto mb-2" />
              <p>{loadError}</p>
            </div>
          ) : videoSrc ? (
            <video
              ref={videoRef}
              src={videoSrc}
              controls
              autoPlay={false}
              className="w-full h-full max-h-full object-contain outline-none"
              onLoadedMetadata={(e) => {
                if (!video.durationSec) {
                  db.videos.update(video.id, {
                    durationSec: e.currentTarget.duration,
                  });
                }
              }}
              // ★ onPlayでDB更新するとuseLiveQuery→video変更→useEffectが走り直して
              //   再生がリセットされるので、ここでは更新しない
              // onPlay={() => {
              //   db.videos.update(video.id, {
              //     lastPlayedAt: Date.now(),
              //     playCount: (video.playCount || 0) + 1,
              //   });
              // }}
            />
          ) : (
            <RiLoader4Line className="animate-spin text-4xl text-text-dim" />
          )}
        </div>

        {/* Right: Metadata & Tools */}
        <div className="w-full lg:w-96 bg-bg-surface border-l border-border p-6 flex flex-col gap-8 overflow-y-auto">
          {/* Metadata Section */}
          <div className="space-y-4">
            {hasTitle ? (
              <h1 className="font-heading text-2xl font-bold leading-tight text-text-main">
                {video.titleOverride}
              </h1>
            ) : (
              <div className="text-sm text-text-dim italic font-mono break-all">
                {video.filename}
              </div>
            )}

            {/* Tags (placeholder) */}
            <div className="flex flex-wrap gap-2">
              {video.tags.length > 0 ? (
                video.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded bg-bg-panel border border-border text-xs text-text-muted"
                  >
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-text-dim opacity-50">No tags</span>
              )}
            </div>

            <div className="text-xs text-text-dim space-y-1">
              <p>
                Filename:{' '}
                <span className="font-mono select-all">{video.filename}</span>
              </p>
              <p>Added: {new Date(video.addedAt).toLocaleDateString()}</p>
              <p>Plays: {video.playCount || 0}</p>
            </div>
          </div>

          <div className="h-px bg-border w-full" />

          {/* Thumbnail Section */}
          <div className="space-y-4">
            <div className="flex items中心">
              <h3 className="font-medium text-sm text-text-muted uppercase tracking-wider">
                Thumbnail
              </h3>
            </div>

            <div className="aspect-video bg-bg-panel rounded-lg border border-border overflow-hidden relative flex items-center justify-center">
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center text-text-dim opacity-50">
                  <RiMovieFill className="text-3xl mb-1" />
                  <span className="text-xs">No thumbnail</span>
                </div>
              )}
            </div>

            <ThumbnailActions
              video={video}
              videoRef={videoRef}
              onThumbnailChange={handleThumbnailChange}
            />

            <p className="text-[10px] text-text-dim mt-2">
              Capture from video frame or upload an image. Saved in local
              database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoDetailPage;
