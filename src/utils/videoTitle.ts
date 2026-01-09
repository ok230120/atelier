// FILE: src/utils/videoTitle.ts
export function stripExt(name: string): string {
  const s = name ?? "";
  const i = s.lastIndexOf(".");
  // 拡張子を取り除く（.より前の部分を返す）
  return i > 0 ? s.slice(0, i) : s;
}

export function getDisplayTitle(video: { titleOverride?: string; filename: string }): string {
  const t = (video.titleOverride ?? "").trim();
  // titleOverrideがあればそれを、なければ拡張子を取ったファイル名を返す
  return t ? t : stripExt(video.filename);
}