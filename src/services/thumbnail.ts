// FILE: src/services/thumbnail.ts

import { db } from '../db/client';
import type { Video } from '../types/domain';

const AUTO_THUMB_WIDTH = 320;
const AUTO_THUMB_HEIGHT = 180;
const AUTO_THUMB_QUALITY = 0.8;
const MIN_BRIGHTNESS = 18;
const MAX_PARALLEL_JOBS = 2;

const queuedVideoIds = new Set<string>();
const activeVideoIds = new Set<string>();
const pendingJobs: Array<() => Promise<void>> = [];

/**
 * Service for handling thumbnail generation and manipulation.
 */

// Capture current frame from a video element
export async function captureCurrentFrame(
  video: HTMLVideoElement,
  width = AUTO_THUMB_WIDTH,
  height = AUTO_THUMB_HEIGHT,
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL('image/webp', AUTO_THUMB_QUALITY);
  } catch (err) {
    console.error('Failed to capture video frame:', err);
    return null;
  }
}

function createCanvas(width = AUTO_THUMB_WIDTH, height = AUTO_THUMB_HEIGHT) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getFrameBrightness(video: HTMLVideoElement): number | null {
  try {
    const canvas = createCanvas();
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let sum = 0;
    const pixels = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }

    return pixels > 0 ? sum / pixels : null;
  } catch (err) {
    console.error('Failed to inspect frame brightness:', err);
    return null;
  }
}

function waitForEvent(target: EventTarget, eventName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleDone = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`Failed while waiting for ${eventName}`));
    };
    const cleanup = () => {
      target.removeEventListener(eventName, handleDone);
      target.removeEventListener('error', handleError);
    };

    target.addEventListener(eventName, handleDone, { once: true });
    target.addEventListener('error', handleError, { once: true });
  });
}

function waitForLoadedMetadata(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 1) return Promise.resolve();
  return waitForEvent(video, 'loadedmetadata');
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return waitForEvent(video, 'seeked');
}

function createHiddenVideo(src: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous';
  video.style.position = 'fixed';
  video.style.left = '-99999px';
  video.style.top = '0';
  video.style.width = '1px';
  video.style.height = '1px';
  document.body.appendChild(video);
  return video;
}

function cleanupVideo(video: HTMLVideoElement) {
  try {
    video.pause();
  } catch {
    // ignore
  }
  video.removeAttribute('src');
  video.load();
  video.remove();
}

function getCandidateTimes(durationSec: number): number[] {
  const duration = Math.max(0, durationSec);
  if (!Number.isFinite(duration) || duration <= 0) return [0];

  const raw = [
    Math.min(duration * 0.1, 12),
    Math.min(duration * 0.35, 45),
    Math.min(duration * 0.65, Math.max(duration - 1, 0)),
  ];

  return Array.from(
    new Set(
      raw
        .map((value) => Math.max(0, Math.min(duration - 0.1, value)))
        .filter((value) => Number.isFinite(value) && value >= 0),
    ),
  );
}

async function seekVideo(video: HTMLVideoElement, timeSec: number) {
  const current = Number.isFinite(video.currentTime) ? video.currentTime : -1;
  if (Math.abs(current - timeSec) < 0.01) return;
  video.currentTime = timeSec;
  await waitForSeek(video);
}

async function generateThumbnailFromSrc(src: string): Promise<{ durationSec?: number; thumbnail?: string }> {
  const video = createHiddenVideo(src);

  try {
    await waitForLoadedMetadata(video);
    const durationSec = Number.isFinite(video.duration) ? video.duration : undefined;

    if (!durationSec || durationSec <= 0) {
      return { durationSec };
    }

    const times = getCandidateTimes(durationSec);
    let fallbackThumb: string | undefined;

    for (const timeSec of times) {
      await seekVideo(video, timeSec);
      const thumbnail = await captureCurrentFrame(video);
      if (!thumbnail) continue;

      const brightness = getFrameBrightness(video);
      if (fallbackThumb == null) fallbackThumb = thumbnail;
      if (brightness == null || brightness >= MIN_BRIGHTNESS) {
        return { durationSec, thumbnail };
      }
    }

    return { durationSec, thumbnail: fallbackThumb };
  } finally {
    cleanupVideo(video);
  }
}

export async function generateAutoThumbnailForVideo(video: Video): Promise<void> {
  if (video.isMissing) return;
  if (video.thumbnail && video.thumbnailSource === 'manual') return;

  let objectUrl: string | null = null;

  try {
    let src: string | undefined;

    if (video.pathKind === 'handle' && video.fileHandle) {
      const file = await video.fileHandle.getFile();
      objectUrl = URL.createObjectURL(file);
      src = objectUrl;
    } else if (video.pathKind === 'url' && video.url) {
      src = video.url;
    }

    if (!src) return;

    const latest = await db.videos.get(video.id);
    if (!latest || latest.isMissing || (latest.thumbnail && latest.thumbnailSource === 'manual')) {
      return;
    }

    const { durationSec, thumbnail } = await generateThumbnailFromSrc(src);
    const changes: Partial<Video> = {};

    if (durationSec !== undefined && latest.durationSec == null) {
      changes.durationSec = durationSec;
    }

    if (!latest.thumbnail && thumbnail) {
      changes.thumbnail = thumbnail;
      changes.thumbnailSource = 'auto';
    }

    if (Object.keys(changes).length > 0) {
      await db.videos.update(video.id, changes);
    }
  } catch (err) {
    console.error(`Failed to generate automatic thumbnail for ${video.id}:`, err);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function runQueue() {
  while (pendingJobs.length > 0 && activeVideoIds.size < MAX_PARALLEL_JOBS) {
    const job = pendingJobs.shift();
    if (!job) break;
    void job();
  }
}

export function queueAutoThumbnailGeneration(video: Video) {
  if (video.isMissing) return;
  if (video.thumbnail && video.thumbnailSource === 'manual') return;
  if (video.durationSec != null && video.thumbnail) return;
  if (queuedVideoIds.has(video.id) || activeVideoIds.has(video.id)) return;

  queuedVideoIds.add(video.id);
  pendingJobs.push(async () => {
    queuedVideoIds.delete(video.id);
    activeVideoIds.add(video.id);
    try {
      await generateAutoThumbnailForVideo(video);
    } finally {
      activeVideoIds.delete(video.id);
      runQueue();
    }
  });
  runQueue();
}

export function queueAutoThumbnailGenerationForVideos(videos: Video[]) {
  for (const video of videos) {
    queueAutoThumbnailGeneration(video);
  }
}

// Convert File object to data URL
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        resolve(e.target.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Read image from clipboard as data URL
export async function readClipboardImageAsDataUrl(): Promise<string | null> {
  try {
    if (!('clipboard' in navigator) || !('read' in navigator.clipboard)) {
      return null;
    }

    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const file = new File([blob], 'clipboard-image', { type: imageType });
        return await fileToDataUrl(file);
      }
    }

    return null;
  } catch (err) {
    console.error('Failed to read from clipboard:', err);
    return null;
  }
}
