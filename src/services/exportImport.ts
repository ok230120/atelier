// FILE: src/services/exportImport.ts
import { db } from "../db/client";
import type { Video, FolderMount, AppSettings } from "../types/domain";

// Export Schema
export interface AtelierExportData {
  app: "atelier";
  version: number;
  exportedAt: string;
  data: {
    mounts: Omit<FolderMount, "dirHandle">[];
    videos: Omit<Video, "fileHandle">[];
    settings?: Omit<AppSettings, "thumbDirHandle">;
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function assertArray(name: string, v: unknown): asserts v is unknown[] {
  if (!Array.isArray(v)) throw new Error(`Invalid backup file format (${name} is not an array).`);
}

function formatDateYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * DBの内容をJSONファイルとしてエクスポート（ダウンロード）する
 * FileSystemHandle はシリアライズできないため除外する
 */
export async function exportDatabase(): Promise<void> {
  try {
    const mounts = await db.mounts.toArray();
    const videos = await db.videos.toArray();
    const settings = await db.settings.get("app");

    // ハンドルを除外して新しいオブジェクトを作成
    const cleanMounts = mounts.map(({ dirHandle, ...rest }) => rest);
    const cleanVideos = videos.map(({ fileHandle, ...rest }) => rest);

    let cleanSettings: Omit<AppSettings, "thumbDirHandle"> | undefined = undefined;
    if (settings) {
      const { thumbDirHandle, ...rest } = settings as AppSettings;
      cleanSettings = rest;
    }

    const exportData: AtelierExportData = {
      app: "atelier",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        mounts: cleanMounts,
        videos: cleanVideos,
        settings: cleanSettings,
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `atelier-backup-${formatDateYYYYMMDD(new Date())}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Export failed:", err);
    throw new Error("Failed to export database.");
  }
}

/**
 * JSONファイルを読み込み、DBにインポートする
 *
 * mode:
 * - replace: mounts/videos を置き換え（settings はバックアップがあれば反映。thumbDirHandle は既存を保持）
 * - merge:   mounts/videos を upsert で統合（settings はバックアップがあれば上書き。thumbDirHandle は既存を保持）
 */
export async function importDatabase(
  file: File,
  mode: "merge" | "replace"
): Promise<{ mounts: number; videos: number }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;

    if (!isRecord(parsed)) throw new Error("Invalid backup file format (root is not an object).");

    const app = parsed.app;
    const data = parsed.data;

    if (app !== "atelier" || !isRecord(data)) {
      throw new Error("Invalid backup file format.");
    }

    assertArray("data.mounts", data.mounts);
    assertArray("data.videos", data.videos);

    const mountsRaw = data.mounts;
    const videosRaw = data.videos;

    // settings は optional（古いバックアップも許容）
    const settingsRaw = data.settings;
    if (settingsRaw !== undefined && !isRecord(settingsRaw)) {
      throw new Error("Invalid backup file format (data.settings is not an object).");
    }

    // handle は復元できないので undefined を入れて Dexie/型を揃える
    const mountsToPut = mountsRaw.map((m) => ({
      ...(m as any),
      dirHandle: undefined,
    })) as FolderMount[];

    const videosToPut = videosRaw.map((v) => ({
      ...(v as any),
      fileHandle: undefined,
    })) as Video[];

    await db.transaction("rw", db.mounts, db.videos, db.settings, async () => {
      if (mode === "replace") {
        await db.mounts.clear();
        await db.videos.clear();
        // settings は「バックアップがあるなら反映」するが、thumbDirHandle を守るため clear はしない
      }

      if (mountsToPut.length > 0) {
        await db.mounts.bulkPut(mountsToPut);
      }
      if (videosToPut.length > 0) {
        await db.videos.bulkPut(videosToPut);
      }

      if (settingsRaw) {
        const existing = await db.settings.get("app");

        // thumbDirHandle はバックアップに入らないので、既存を保持
        await db.settings.put({
          ...existing,
          ...(settingsRaw as any),
          id: "app",
          thumbDirHandle: (existing as any)?.thumbDirHandle,
        } as AppSettings);
      }
    });

    return { mounts: mountsToPut.length, videos: videosToPut.length };
  } catch (err) {
    console.error("Import failed:", err);
    throw err;
  }
}
