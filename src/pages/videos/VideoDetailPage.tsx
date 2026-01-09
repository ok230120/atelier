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
  RiRotateLockLine,
} from 'react-icons/ri';

import { db } from '../../db/client';
import { fileSystem } from '../../services/fileSystem';
import ThumbnailActions from './components/ThumbnailActions';
import VideoTagsEditor from './components/VideoTagsEditor';
import DeleteVideoButton from './components/DeleteVideoButton';
import TagSelectDrawer from './components/TagSelectDrawer';
import { useAllTagsQuery } from '../../hooks/useAllTagsQuery';
import InlineTitleEditor from '../../components/InlineTitleEditor';
import { stripExt } from '../../utils/videoTitle';
import { setVideoTitleOverride, clearVideoTitleOverride } from '../../services/videoMeta';

const VideoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);

  // 現在のBlob URLを保持(再生成時にrevokeする)
  const blobUrlRef = useRef<string | null>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [rotation, setRotation] = useState(0);
  // 既存タグを一覧で選ぶ Drawer
  const [tagDrawerOpen, setTagDrawerOpen] = useState(false);

  // Dexie から動画メタデータを取得
  const video = useLiveQuery(async () => {
    if (!id) return null;
    return await db.videos.get(id); 
  }, [id]);

  const clearBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  // 全動画から全タグを集計
  const { tags: allTags, isLoading: allTagsLoading } = useAllTagsQuery({
    enabled: true,
  });

  // Apply(まとめて保存)
  const applyTags = async (nextTags: string[]) => {
    if (!video) return;
    await db.videos.update(video.id, { tags: nextTags });
  };

  const setBlobUrl = (url: string) => {
    clearBlobUrl();
    blobUrlRef.current = url;
    setVideoSrc(url);
  };

  // 動画ファイルのURLを準備(Blob URL など)
  // ★重要: 依存を video 全体にしない(tags/favorite更新で再生がリセットされるのを防ぐ)
  useEffect(() => {
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
          setBlobUrl(URL.createObjectURL(file));
        } else if (video.pathKind === 'url' && video.url) {
          clearBlobUrl();
          setVideoSrc(video.url);
        } else {
          setLoadError('Video path or handle is missing.');
        }
      } catch (err: any) {
        console.error('Error loading video source:', err);
        setLoadError(err?.message || 'Failed to load video file.');
      }
    };

    loadSource();

    return () => {
      // ソース切替/アンマウント時にBlob URLを掃除
      clearBlobUrl();
    };
    // tags/title/favorite等で再実行されないよう、ソースに関係するものだけ依存にする
  }, [video?.id, video?.pathKind, video?.fileHandle, video?.url]);

  const handleRateChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setPlaybackRate(rate);
  };

  const toggleFavorite = async () => {
    if (!video) return;
    await db.videos.update(video.id, { favorite: !video.favorite });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleThumbnailChange = async (dataUrl: string | null) => {
    if (!video) return;
    // TODO: thumbStore === "folder" のときはファイル保存に切り替える
    await db.videos.update(video.id, { thumbnail: dataUrl || undefined });
  };

  const requestPermission = async () => {
    if (!video?.fileHandle) return;

    try {
      // TSのDOM型が追いついてない環境だと requestPermission が赤線になりがちなのでanyで逃がす
      const handleAny = video.fileHandle as any;
      const result = await handleAny.requestPermission?.({ mode: 'read' });
      if (result === 'granted') {
        setPermissionNeeded(false);
        const file = await video.fileHandle.getFile();
        setBlobUrl(URL.createObjectURL(file));
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
                  playbackRate === rate ? 'bg-accent text-white' : 'text-text-muted hover:text-text-main',
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
          {/* Rotate Button */}
          <button
            onClick={handleRotate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border bg-bg-panel text-text-muted border-border hover:border-text-dim hover:text-text-main"
            title={`Rotate ${rotation}°`}
          >
            <RiRotateLockLine />
            <span>{rotation}°</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-y-auto lg:overflow-hidden flex-col lg:flex-row">
        {/* Left: Video Player */}
        <div className="flex-1 bg-black flex items-center justify-center relative min-h-[300px] lg:h-full">
          {permissionNeeded ? (
            <div className="text-center p-8">
              <p className="text-text-main mb-4">Permission required to play this file.</p>
              <button onClick={requestPermission} className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90">
                Grant Permission
              </button>
            </div>
          ) : loadError ? (
            <div className="text-center text-red-400 p-8">
              <RiErrorWarningLine className="text-4xl mx-auto mb-2" />
              <p>{loadError}</p>
            </div>
          ) : videoSrc ? (
            <div
              className="flex items-center justify-center"
              style={{
                transform: `rotate(${rotation}deg)`,
                width: rotation % 180 === 90 ? '80vh' : '100%',
                height: rotation % 180 === 90 ? '80vh' : '100%',
              }}
            >
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                autoPlay={false}
                className="w-full h-full object-contain outline-none"
                onLoadedMetadata={(e) => {
                  // 再生速度を維持
                  e.currentTarget.playbackRate = playbackRate;

                  if (!video.durationSec) {
                    db.videos.update(video.id, {
                      durationSec: e.currentTarget.duration,
                    });
                  }
                }}
              />
            </div>
          ) : (
            <RiLoader4Line className="animate-spin text-4xl text-text-dim" />
          )}
        </div>

        {/* Right: Metadata & Tools */}
        <div className="w-full lg:w-96 bg-bg-surface border-l border-border p-6 flex flex-col gap-8 overflow-y-auto">
          {/* Metadata Section */}
          <div className="space-y-4">
            <InlineTitleEditor
              value={video.titleOverride}
              fallback={stripExt(video.filename)}
              onSave={(t) => setVideoTitleOverride(video.id, t)}
              onClear={() => clearVideoTitleOverride(video.id)}
            />

            <div className="text-xs text-text-dim">
              <p className="break-all">
                Filename: <span className="font-mono select-all">{video.filename}</span>
              </p>
            </div>
          </div>

          {/* Tags Editor + 既存タグから選ぶ */}
          <div className="space-y-3">
            <VideoTagsEditor video={video} />

            <button
              type="button"
              onClick={() => setTagDrawerOpen(true)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-bg-panel hover:border-accent/50 text-sm"
            >
              {allTagsLoading ? '既存タグを読み込み中...' : '既存タグから選ぶ'}
            </button>
          </div>

          <TagSelectDrawer
            open={tagDrawerOpen}
            onClose={() => setTagDrawerOpen(false)}
            allTags={allTags}
            isLoading={allTagsLoading}
            selectedTags={video?.tags ?? []}
            onApply={applyTags}
          />

          <div className="h-px bg-border w-full" />

          {/* Thumbnail Section */}
          <div className="space-y-4">
            <div className="flex items-center">
              <h3 className="font-medium text-sm text-text-muted uppercase tracking-wider">Thumbnail</h3>
            </div>

            <div className="aspect-video bg-bg-panel rounded-lg border border-border overflow-hidden relative flex items-center justify-center">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-text-dim opacity-50">
                  <RiMovieFill className="text-3xl mb-1" />
                  <span className="text-xs">No thumbnail</span>
                </div>
              )}
            </div>

            <ThumbnailActions video={video} videoRef={videoRef} onThumbnailChange={handleThumbnailChange} />

            <p className="text-[10px] text-text-dim mt-2">Capture from video frame or upload an image. Saved in local database.</p>
          </div>

          <div className="h-px bg-border w-full" />

          <DeleteVideoButton videoId={video.id} confirmText="この動画の登録データを削除しますか？(元ファイルは消しません)" />
        </div>
      </div>
    </div>
  );
};

export default VideoDetailPage;