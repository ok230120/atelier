// FILE: src/pages/videos/VideoDetailPage.tsx

import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import classNames from 'classnames';
import {
  RiArrowLeftLine,
  RiErrorWarningLine,
  RiHeart3Fill,
  RiHeart3Line,
  RiLoader4Line,
  RiMovieFill,
  RiRotateLockLine,
  RiSpeedLine,
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
import { clearVideoTitleOverride, setVideoTitleOverride } from '../../services/videoMeta';

const VideoDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const playedThisVisitRef = useRef(false);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [tagDrawerOpen, setTagDrawerOpen] = useState(false);

  const video = useLiveQuery(async () => {
    if (!id) return null;
    return db.videos.get(id);
  }, [id]);

  const { tags: allTags, isLoading: allTagsLoading } = useAllTagsQuery({ enabled: true });

  const clearBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  const setBlobUrl = (url: string) => {
    clearBlobUrl();
    blobUrlRef.current = url;
    setVideoSrc(url);
  };

  useEffect(() => {
    playedThisVisitRef.current = false;
    setLoadError(null);
    setPermissionNeeded(false);
    setVideoSrc(null);

    const loadSource = async () => {
      if (!video) return;
      if (video.isMissing) {
        setLoadError('元ファイルが見つかりません。管理画面で状態を確認してください。');
        return;
      }

      try {
        if (video.pathKind === 'handle' && video.fileHandle) {
          const hasPerm = await fileSystem.verifyPermission(video.fileHandle, 'read');
          if (!hasPerm) {
            setPermissionNeeded(true);
            return;
          }

          const file = await video.fileHandle.getFile();
          setBlobUrl(URL.createObjectURL(file));
          return;
        }

        if (video.pathKind === 'url' && video.url) {
          clearBlobUrl();
          setVideoSrc(video.url);
          return;
        }

        setLoadError('動画ファイルの参照情報がありません。');
      } catch (err: any) {
        console.error('Error loading video source:', err);
        setLoadError(err?.message || '動画ファイルの読み込みに失敗しました。');
      }
    };

    void loadSource();

    return () => {
      clearBlobUrl();
    };
  }, [video?.id, video?.pathKind, video?.fileHandle, video?.url, video?.isMissing]);

  const applyTags = async (nextTags: string[]) => {
    if (!video) return;
    await db.videos.update(video.id, { tags: nextTags });
  };

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
    await db.videos.update(video.id, {
      thumbnail: dataUrl || undefined,
      thumbnailSource: dataUrl ? 'manual' : undefined,
    });
  };

  const requestPermission = async () => {
    if (!video?.fileHandle) return;

    try {
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

  const trackPlayback = async () => {
    if (!video || playedThisVisitRef.current) return;
    playedThisVisitRef.current = true;

    await db.videos.update(video.id, {
      lastPlayedAt: Date.now(),
      playCount: (video.playCount ?? 0) + 1,
    });
  };

  if (id && video === undefined) {
    return (
      <div className="h-full flex items-center justify-center text-accent">
        <RiLoader4Line className="animate-spin text-4xl" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-dim">
        <RiErrorWarningLine className="text-5xl mb-4 opacity-50" />
        <h2 className="text-xl font-medium">動画が見つかりません</h2>
        <Link to="/videos" className="mt-4 text-accent hover:underline">
          ライブラリへ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="h-12 border-b border-border bg-bg-surface flex items-center justify-between px-6 flex-shrink-0 z-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition-colors"
        >
          <RiArrowLeftLine />
          <span>戻る</span>
        </button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs bg-bg-panel rounded-full px-1 py-0.5 border border-border">
            <RiSpeedLine className="ml-2 text-text-dim" />
            {[1, 1.25, 1.5, 2].map((rate) => (
              <button
                key={rate}
                type="button"
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

          <button
            type="button"
            onClick={toggleFavorite}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
              video.favorite
                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                : 'bg-bg-panel text-text-muted border-border hover:border-text-dim hover:text-text-main',
            )}
          >
            {video.favorite ? <RiHeart3Fill /> : <RiHeart3Line />}
            <span>{video.favorite ? 'お気に入り済み' : 'お気に入り'}</span>
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border bg-bg-panel text-text-muted border-border hover:border-text-dim hover:text-text-main"
            title={`${rotation}° 回転`}
          >
            <RiRotateLockLine />
            <span>{rotation}°</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 overflow-y-auto lg:overflow-hidden flex-col lg:flex-row">
        <div className="flex-1 bg-black flex items-center justify-center relative min-h-[300px] lg:h-full">
          {video.isMissing ? (
            <div className="text-center text-yellow-200 p-8">
              <RiErrorWarningLine className="text-4xl mx-auto mb-2" />
              <p className="font-medium">元ファイルが見つかりません</p>
              <Link to="/manage" className="inline-block mt-4 text-sm text-accent hover:underline">
                管理画面で確認する
              </Link>
            </div>
          ) : permissionNeeded ? (
            <div className="text-center p-8">
              <p className="text-text-main mb-4">この動画を再生するにはフォルダへの読み取り権限が必要です。</p>
              <button
                type="button"
                onClick={requestPermission}
                className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90"
              >
                権限を許可
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
                onPlay={() => void trackPlayback()}
                onLoadedMetadata={(e) => {
                  e.currentTarget.playbackRate = playbackRate;

                  if (!video.durationSec) {
                    void db.videos.update(video.id, {
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

        <div className="w-full lg:w-96 bg-bg-surface border-l border-border p-6 flex flex-col gap-8 overflow-y-auto">
          <div className="space-y-4">
            <InlineTitleEditor
              value={video.titleOverride}
              fallback={stripExt(video.filename)}
              onSave={(t) => setVideoTitleOverride(video.id, t)}
              onClear={() => clearVideoTitleOverride(video.id)}
            />

            <div className="text-xs text-text-dim space-y-1">
              <p className="break-all">
                ファイル名: <span className="font-mono select-all">{video.filename}</span>
              </p>
              {video.relativePath && (
                <p className="break-all">
                  相対パス: <span className="font-mono select-all">{video.relativePath}</span>
                </p>
              )}
              <p>
                再生回数: <span className="text-text-main">{video.playCount ?? 0}</span>
              </p>
              {video.lastPlayedAt && (
                <p>
                  最終再生: <span className="text-text-main">{new Date(video.lastPlayedAt).toLocaleString()}</span>
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <VideoTagsEditor video={video} />

            <button
              type="button"
              onClick={() => setTagDrawerOpen(true)}
              className="w-full px-3 py-2 rounded-xl border border-border bg-bg-panel hover:border-accent/50 text-sm"
            >
              {allTagsLoading ? 'タグを読み込み中...' : '既存タグから選ぶ'}
            </button>
          </div>

          <TagSelectDrawer
            open={tagDrawerOpen}
            onClose={() => setTagDrawerOpen(false)}
            title="既存タグから選択"
            allTags={allTags}
            isLoading={allTagsLoading}
            selectedTags={video.tags ?? []}
            onApply={applyTags}
          />

          <div className="h-px bg-border w-full" />

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium text-sm text-text-muted uppercase tracking-wider">Thumbnail</h3>
              {video.thumbnailSource && (
                <span className="text-[10px] rounded-full border border-border px-2 py-0.5 text-text-dim">
                  {video.thumbnailSource === 'manual' ? '手動' : '自動'}
                </span>
              )}
            </div>

            <div className="aspect-video bg-bg-panel rounded-lg border border-border overflow-hidden relative flex items-center justify-center">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-text-dim opacity-50">
                  <RiMovieFill className="text-3xl mb-1" />
                  <span className="text-xs">サムネイル未設定</span>
                </div>
              )}
            </div>

            <ThumbnailActions video={video} videoRef={videoRef} onThumbnailChange={handleThumbnailChange} />

            <p className="text-[10px] text-text-dim mt-2">
              自動サムネイルは初期候補です。気に入らなければ現在のフレーム取得や画像アップロードで上書きできます。
            </p>
          </div>

          <div className="h-px bg-border w-full" />

          <DeleteVideoButton
            videoId={video.id}
            confirmText="この動画の登録データを削除しますか？（元ファイルは削除しません）"
            onDeleted={() => navigate('/videos')}
          />
        </div>
      </div>
    </div>
  );
};

export default VideoDetailPage;
