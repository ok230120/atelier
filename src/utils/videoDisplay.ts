// FILE: src/utils/videoDisplay.ts
import type { Video } from '../types/domain';

export function basename(path: string): string {
  const p = (path || '').replace(/\\/g, '/');
  const parts = p.split('/');
  return parts[parts.length - 1] || path;
}

export function stripExt(name: string): string {
  const base = basename(name);
  const i = base.lastIndexOf('.');
  // ".bashrc" みたいな先頭ドットは拡張子扱いしない
  if (i <= 0) return base;
  return base.slice(0, i);
}

export function getVideoDisplayTitle(video: Video): string {
  const raw = (video.titleOverride && video.titleOverride.trim())
    ? video.titleOverride
    : (video.filename || '');
  return stripExt(raw);
}
