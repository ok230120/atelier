// FILE: src/services/videoMeta.ts
import { db } from "../db/client";

export async function setVideoTitleOverride(videoId: string, title: string) {
  const t = title.trim();
  // 空文字なら設定を削除、文字があれば上書き
  await db.videos.update(videoId, { titleOverride: t ? t : undefined });
}

export async function clearVideoTitleOverride(videoId: string) {
  await db.videos.update(videoId, { titleOverride: undefined });
}