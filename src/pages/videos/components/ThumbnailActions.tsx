// FILE: src/pages/videos/components/ThumbnailActions.tsx

import React, { useRef } from 'react';
import { Video } from '../../../types/domain';
import {
  captureCurrentFrame,
  fileToDataUrl,
  readClipboardImageAsDataUrl,
} from '../../../services/thumbnail';
import {
  RiCameraLine,
  RiImageAddLine,
  RiClipboardLine,
  RiDeleteBinLine,
  RiDownloadLine,
} from 'react-icons/ri';
import classNames from 'classnames';

interface ThumbnailActionsProps {
  video: Video;
  videoRef: React.RefObject<HTMLVideoElement>;
  onThumbnailChange: (dataUrl: string | null) => void;
}

const ThumbnailActions: React.FC<ThumbnailActionsProps> = ({
  video,
  videoRef,
  onThumbnailChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const dataUrl = await captureCurrentFrame(videoRef.current);
    if (dataUrl) {
      onThumbnailChange(dataUrl);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const dataUrl = await fileToDataUrl(file);
        onThumbnailChange(dataUrl);
      } catch (err) {
        console.error(err);
        alert('Failed to load image file.');
      }
    }
    // 同じファイルを選び直せるようにリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClipboard = async () => {
    try {
      const dataUrl = await readClipboardImageAsDataUrl();
      if (dataUrl) {
        onThumbnailChange(dataUrl);
      } else {
        alert('No image found in clipboard.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to access clipboard. Make sure the browser window is active.');
    }
  };

  const handleDownload = () => {
    if (!video.thumbnail) return;

    const link = document.createElement('a');
    link.href = video.thumbnail;
    const baseName = video.filename.split('.')[0] || video.id;
    link.download = `${baseName}_thumb.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        className="hidden"
      />

      <ActionButton
        icon={RiCameraLine}
        label="Capture Frame"
        onClick={handleCapture}
        title="Capture current video frame as thumbnail"
      />

      <ActionButton
        icon={RiImageAddLine}
        label="Upload"
        onClick={() => fileInputRef.current?.click()}
        title="Select image file"
      />

      <ActionButton
        icon={RiClipboardLine}
        label="Paste"
        onClick={handleClipboard}
        title="Paste image from clipboard"
      />

      {video.thumbnail && (
        <>
          <div className="w-px h-6 bg-border mx-1 self-center" />

          <ActionButton
            icon={RiDownloadLine}
            onClick={handleDownload}
            title="Download thumbnail"
            className="text-text-dim hover:text-text-main"
          />

          <ActionButton
            icon={RiDeleteBinLine}
            onClick={() => onThumbnailChange(null)}
            title="Remove thumbnail"
            className="text-text-dim hover:text-red-400"
          />
        </>
      )}
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ElementType;
  label?: string;
  onClick: () => void;
  title?: string;
  className?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  title,
  className,
}) => (
  <button
    onClick={onClick}
    title={title}
    className={classNames(
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border border-border bg-bg-surface hover:bg-bg-panel hover:border-text-dim active:scale-95',
      className || 'text-text-muted hover:text-text-main',
    )}
  >
    <Icon className="text-sm" />
    {label && <span>{label}</span>}
  </button>
);

export default ThumbnailActions;
