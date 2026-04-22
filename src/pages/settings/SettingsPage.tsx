// FILE: src/pages/settings/SettingsPage.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  RiDatabase2Line,
  RiDownloadCloud2Line,
  RiUploadCloud2Line,
  RiPriceTag3Line,
  RiSearchLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiErrorWarningLine,
  RiSettings4Line,
  RiFolderOpenLine,
  RiPushpinLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiAddLine,
} from 'react-icons/ri';
import classNames from 'classnames';
import { db } from '../../db/client';
import { exportDatabase, importDatabase } from '../../services/exportImport';
import { fileSystem } from '../../services/fileSystem';
import type { AppSettings, Video } from '../../types/domain';

// タグ正規化ヘルパー
const normalizeTag = (tag: string): string => {
  return tag.trim().toLowerCase().replace(/\s+/g, '-').replace(/^#/, '');
};

const BATCH_SIZE = 50;

interface TagStat {
  name: string;
  count: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  schemaVersion: 1,
  pinnedTags: [],
  tagSort: 'popular',
  filterMode: 'AND',
  thumbStore: 'idb',
};

const SettingsPage: React.FC = () => {
  // --- アプリ設定 ---
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // 非同期更新中に常に最新設定を参照するための ref
  const appSettingsRef = useRef<AppSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    appSettingsRef.current = appSettings;
  }, [appSettings]);

  // 連打時の race condition を避けるため設定書き込みを直列化
  const settingsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());

  // --- エクスポート/インポート状態 ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [isProcessingIO, setIsProcessingIO] = useState(false);

  // --- タグ管理状態 ---
  const [tags, setTags] = useState<TagStat[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');

  // タグ操作
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState('');

  // ピン留めタグ状態
  const [newPinInput, setNewPinInput] = useState('');

  // 一括処理進捗
  const [progress, setProgress] = useState<{ current: number; total: number; message?: string } | null>(
    null
  );

  // --- 初期化 ---
  const loadSettings = async () => {
    try {
      const s = await db.settings.get('app');
      const merged: AppSettings = s
        ? ({ ...DEFAULT_SETTINGS, ...s, id: 'app' } as AppSettings)
        : DEFAULT_SETTINGS;

      setAppSettings(merged);
      appSettingsRef.current = merged;
    } catch (err) {
      console.error('設定の読み込みに失敗しました:', err);
    }
  };

  const loadTags = async () => {
    setIsLoadingTags(true);
    try {
      const allVideos = await db.videos.toArray();
      const counts = new Map<string, number>();

      for (const v of allVideos) {
        const list = v.tags ?? [];
        for (const t of list) {
          counts.set(t, (counts.get(t) || 0) + 1);
        }
      }

      const sorted = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      setTags(sorted);
    } catch (err) {
      console.error('タグの読み込みに失敗しました:', err);
    } finally {
      setIsLoadingTags(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadTags();
  }, []);

  // --- 補助: タグ検索（index fast path + fallback） ---
  const findVideosWithTag = async (tag: string): Promise<Video[]> => {
    try {
      // Fast path (Dexie schema に tags の multiEntry index が必要)
      const table = db.videos as any;
      return (await table.where('tags').equals(tag).toArray()) as Video[];
    } catch (err) {
      // Fallback: 常に動く（全件走査）
      console.warn('タグ index 検索に失敗したため全件走査へフォールバックします。', err);
      const all = await db.videos.toArray();
      return all.filter((v) => (v.tags ?? []).includes(tag));
    }
  };

  // --- 設定更新 ---
  const updateSettings = (updates: Partial<AppSettings>) => {
    settingsWriteQueueRef.current = settingsWriteQueueRef.current.then(async () => {
      const base = appSettingsRef.current;
      const next: AppSettings = { ...base, ...updates, id: 'app' } as AppSettings;

      try {
        await db.settings.put(next);
        appSettingsRef.current = next;
        setAppSettings(next);
      } catch (err) {
        console.error('設定の保存に失敗しました:', err);
        alert('設定の保存に失敗しました。詳細はコンソールを確認してください。');
      }
    });

    return settingsWriteQueueRef.current;
  };

  const handleThumbStoreChange = async (mode: 'idb' | 'folder') => {
    try {
      if (mode === 'folder') {
        const dirHandle = await fileSystem.pickDirectory();
        if (!dirHandle) return; // cancelled
        await updateSettings({ thumbStore: 'folder', thumbDirHandle: dirHandle });
      } else {
        await updateSettings({ thumbStore: 'idb' });
      }
    } catch (err) {
      console.error('サムネイル保存先の変更に失敗しました:', err);
      alert('サムネイル保存先の変更に失敗しました。詳細はコンソールを確認してください。');
    }
  };

  // --- ピン留めタグ管理 ---
  const addPinnedTag = async () => {
    const tag = normalizeTag(newPinInput);
    if (!tag) return;

    const pinned = appSettingsRef.current.pinnedTags ?? [];
    if (pinned.includes(tag)) {
      setNewPinInput('');
      return;
    }

    await updateSettings({ pinnedTags: [...pinned, tag] });
    setNewPinInput('');
  };

  const removePinnedTag = async (tag: string) => {
    const pinned = appSettingsRef.current.pinnedTags ?? [];
    await updateSettings({ pinnedTags: pinned.filter((t) => t !== tag) });
  };

  const movePinnedTag = async (index: number, direction: 'up' | 'down') => {
    const pinned = appSettingsRef.current.pinnedTags ?? [];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === pinned.length - 1) return;

    const next = [...pinned];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

    await updateSettings({ pinnedTags: next });
  };

  // --- エクスポート/インポート ---
  const handleExport = async () => {
    if (!window.confirm('データベースのバックアップをダウンロードしますか？')) return;
    setIsProcessingIO(true);
    try {
      await exportDatabase();
    } catch (err) {
      console.error(err);
      alert('エクスポートに失敗しました。詳細はコンソールを確認してください。');
    } finally {
      setIsProcessingIO(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const msg =
      importMode === 'replace'
        ? '警告: 「置き換え」モードでは既存データをすべて削除してからインポートします。続行しますか？'
        : 'データをインポートしますか？（追加モード。既存 ID は上書きされます）';

    if (!window.confirm(msg)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessingIO(true);
    try {
      const result = await importDatabase(file, importMode);
      alert(
        `インポートが完了しました。\n` +
          `動画: ${result.videos}\n` +
          `フォルダ: ${result.mounts}\n\n` +
          `重要: フォルダや動画のファイルハンドルはバックアップから復元できません。\n` +
          `アクセスを戻すには「管理」ページで再スキャンしてください。`
      );
      await loadTags();
      await loadSettings();
    } catch (err) {
      console.error(err);
      alert('インポートに失敗しました。ファイルが壊れているか、形式が不正な可能性があります。');
    } finally {
      setIsProcessingIO(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- タグ管理 ---
  const startRename = (tag: string) => {
    setEditingTag(tag);
    setRenameInput(tag);
  };

  const cancelRename = () => {
    setEditingTag(null);
    setRenameInput('');
  };

  const executeRename = async (oldTag: string) => {
    const newTag = normalizeTag(renameInput);
    if (!newTag) return cancelRename();
    if (newTag === oldTag) return cancelRename();

    setEditingTag(null);
    setProgress({ current: 0, total: 0, message: '動画を検索中...' });

    try {
      const videosToUpdate = await findVideosWithTag(oldTag);

      if (videosToUpdate.length === 0) {
        alert('このタグが付いた動画は見つかりませんでした。');
        return;
      }

      setProgress({
        current: 0,
        total: videosToUpdate.length,
        message: `「${oldTag}」を「${newTag}」へ変更中...`,
      });

      const updates: Video[] = videosToUpdate.map((v) => {
        const nextTags = (v.tags ?? [])
          .map((t) => (t === oldTag ? newTag : t))
          .filter((t, i, arr) => arr.indexOf(t) === i); // unique
        return { ...v, tags: nextTags };
      });

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        await db.videos.bulkPut(chunk);

        setProgress((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            current: Math.min(i + BATCH_SIZE, updates.length),
          };
        });

        await new Promise((r) => setTimeout(r, 0));
      }

      await loadTags();
    } catch (err) {
      console.error(err);
      alert('タグ名の変更に失敗しました。');
    } finally {
      setProgress(null);
    }
  };

  const executeDelete = async (tagToDelete: string) => {
    if (!window.confirm(`タグ「#${tagToDelete}」をすべての動画から削除しますか？`)) return;

    setProgress({ current: 0, total: 0, message: '動画を検索中...' });

    try {
      const videosToUpdate = await findVideosWithTag(tagToDelete);

      if (videosToUpdate.length === 0) {
        await loadTags();
        return;
      }

      setProgress({
        current: 0,
        total: videosToUpdate.length,
        message: `タグ「${tagToDelete}」を削除中...`,
      });

      const updates: Video[] = videosToUpdate.map((v) => {
        const nextTags = (v.tags ?? []).filter((t) => t !== tagToDelete);
        return { ...v, tags: nextTags };
      });

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        await db.videos.bulkPut(chunk);

        setProgress((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            current: Math.min(i + BATCH_SIZE, updates.length),
          };
        });

        await new Promise((r) => setTimeout(r, 0));
      }

      await loadTags();
    } catch (err) {
      console.error(err);
      alert('タグ削除に失敗しました。');
    } finally {
      setProgress(null);
    }
  };

  // --- 派生値 ---
  const needle = tagSearch.trim().toLowerCase();
  const filteredTags = needle ? tags.filter((t) => t.name.toLowerCase().includes(needle)) : tags;

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const thumbFolderName =
    appSettings.thumbDirHandle && (appSettings.thumbDirHandle as any).name
      ? (appSettings.thumbDirHandle as any).name
      : 'フォルダ未選択';

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <div className="border-b border-border pb-6">
        <h2 className="font-heading text-2xl font-bold">設定</h2>
        <p className="text-text-dim text-sm mt-1">設定、データ、ライブラリ構成を管理します。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* --- アプリ設定 --- */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-medium text-text-main">
            <RiSettings4Line className="text-accent" />
            <h3>アプリ設定</h3>
          </div>

          <div className="bg-bg-panel border border-border rounded-xl p-6 space-y-6">
            {/* タグ並び順 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-text-main">タグの標準並び順</label>
                <p className="text-xs text-text-dim">フィルターやドロワー内でのタグ順です。</p>
              </div>
              <div className="flex bg-bg-surface rounded-lg p-1 border border-border">
                <button
                  onClick={() => void updateSettings({ tagSort: 'popular' })}
                  className={classNames(
                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                    appSettings.tagSort === 'popular'
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-main'
                  )}
                >
                  人気順
                </button>
                <button
                  onClick={() => void updateSettings({ tagSort: 'alpha' })}
                  className={classNames(
                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                    appSettings.tagSort === 'alpha'
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-main'
                  )}
                >
                  名前順
                </button>
              </div>
            </div>

            {/* フィルタ条件 */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-text-main">タグ絞り込み方式</label>
                <p className="text-xs text-text-dim">複数タグの組み合わせ方を指定します。</p>
              </div>
              <div className="flex bg-bg-surface rounded-lg p-1 border border-border">
                <button
                  onClick={() => void updateSettings({ filterMode: 'AND' })}
                  className={classNames(
                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                    appSettings.filterMode === 'AND'
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-main'
                  )}
                >
                  AND（すべて）
                </button>
                <button
                  onClick={() => void updateSettings({ filterMode: 'OR' })}
                  className={classNames(
                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                    appSettings.filterMode === 'OR'
                      ? 'bg-accent text-white'
                      : 'text-text-muted hover:text-text-main'
                  )}
                >
                  OR（いずれか）
                </button>
              </div>
            </div>

            <div className="h-px bg-border/50 w-full" />

            {/* サムネイル保存先 */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-text-main">サムネイル保存先</label>
                <p className="text-xs text-text-dim">生成したサムネイルの保存場所です。</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => void handleThumbStoreChange('idb')}
                  className={classNames(
                    'p-3 rounded-lg border text-left text-xs transition-colors',
                    appSettings.thumbStore === 'idb'
                      ? 'bg-accent/10 border-accent text-text-main'
                      : 'bg-bg-surface border-border text-text-muted hover:border-text-dim'
                  )}
                >
                  <div className="font-bold mb-1">IndexedDB（標準）</div>
                  ブラウザ内データベースに保存します。バックアップは簡単ですが、容量制限に当たる場合があります。
                </button>

                <button
                  onClick={() => void handleThumbStoreChange('folder')}
                  className={classNames(
                    'p-3 rounded-lg border text-left text-xs transition-colors',
                    appSettings.thumbStore === 'folder'
                      ? 'bg-accent/10 border-accent text-text-main'
                      : 'bg-bg-surface border-border text-text-muted hover:border-text-dim'
                  )}
                >
                  <div className="font-bold mb-1">ローカルフォルダ</div>
                  指定フォルダに `.webp` ファイルとして保存します。大きなライブラリ向けです。
                </button>
              </div>

              {appSettings.thumbStore === 'folder' && (
                <div className="bg-bg-surface border border-border rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-text-muted font-mono">{thumbFolderName}</span>
                    <button
                      onClick={() => void handleThumbStoreChange('folder')}
                      className="text-accent hover:underline flex items-center gap-1"
                    >
                      <RiFolderOpenLine /> 選択
                    </button>
                  </div>
                  <div className="text-orange-400/80 flex items-start gap-1.5">
                    <RiErrorWarningLine className="mt-0.5 shrink-0" />
                    <span>
                      フォルダハンドルはエクスポートできません。バックアップの復元後はこのフォルダを再選択してください。
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* --- バックアップと復元 --- */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-medium text-text-main">
            <RiDatabase2Line className="text-accent" />
            <h3>データ管理</h3>
          </div>

          <div className="bg-bg-panel border border-border rounded-xl p-6 space-y-6 h-fit">
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-text-muted uppercase tracking-wider">バックアップ</h4>
              <p className="text-sm text-text-dim">
                すべてのメタデータ（動画、タグ、フォルダ、設定）を JSON ファイルへ書き出します。
                <br />
                <span className="text-orange-400/80 text-xs flex items-center gap-1 mt-1">
                  <RiErrorWarningLine /> ファイルハンドルは含まれません。
                </span>
              </p>
              <button
                onClick={handleExport}
                disabled={isProcessingIO}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-colors text-sm"
              >
                {isProcessingIO ? <RiLoader4Line className="animate-spin" /> : <RiDownloadCloud2Line />}
                JSON を書き出す
              </button>
            </div>

            <div className="h-px bg-border/50 w-full" />

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-text-muted uppercase tracking-wider">復元</h4>
              <p className="text-sm text-text-dim">バックアップ JSON ファイルからデータを読み込みます。</p>

              <div className="flex items-center gap-3 text-sm justify-center">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="accent-accent"
                  />
                  <span>追加</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-red-500"
                  />
                  <span>置き換え</span>
                </label>
              </div>

              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
              <button
                onClick={handleImportClick}
                disabled={isProcessingIO}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded-lg hover:border-accent hover:text-accent transition-colors text-sm"
              >
                {isProcessingIO ? <RiLoader4Line className="animate-spin" /> : <RiUploadCloud2Line />}
                ファイルを選んで読み込む
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* --- ピン留めタグ管理 --- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-medium text-text-main">
          <RiPushpinLine className="text-accent" />
          <h3>ピン留めタグ</h3>
        </div>

        <div className="bg-bg-panel border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={newPinInput}
              onChange={(e) => setNewPinInput(e.target.value)}
              placeholder="ピン留めするタグを追加..."
              className="bg-bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-main focus:outline-none focus:border-accent flex-1"
              onKeyDown={(e) => e.key === 'Enter' && void addPinnedTag()}
            />
            <button
              onClick={() => void addPinnedTag()}
              disabled={!newPinInput.trim()}
              className="px-3 py-1.5 bg-bg-surface border border-border rounded-lg hover:text-accent hover:border-accent disabled:opacity-50 transition-colors"
            >
              <RiAddLine />
            </button>
          </div>

          {(appSettings.pinnedTags ?? []).length === 0 ? (
            <div className="text-center py-4 text-text-dim text-sm italic">ピン留めタグはありません。よく使うタグを追加してください。</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(appSettings.pinnedTags ?? []).map((tag, idx) => (
                <div
                  key={`${tag}-${idx}`}
                  className="flex items-center gap-1 bg-bg-surface border border-border rounded-lg pl-3 pr-1 py-1 text-sm text-text-muted group"
                >
                  <span>#{tag}</span>
                  <div className="flex flex-col ml-2 border-l border-border pl-1">
                    <button
                      onClick={() => void movePinnedTag(idx, 'up')}
                      disabled={idx === 0}
                      className="text-[10px] hover:text-accent disabled:opacity-20"
                      title="上へ移動"
                    >
                      <RiArrowUpLine />
                    </button>
                    <button
                      onClick={() => void movePinnedTag(idx, 'down')}
                      disabled={idx === (appSettings.pinnedTags ?? []).length - 1}
                      className="text-[10px] hover:text-accent disabled:opacity-20"
                      title="下へ移動"
                    >
                      <RiArrowDownLine />
                    </button>
                  </div>
                  <button
                    onClick={() => void removePinnedTag(tag)}
                    className="ml-1 p-1 hover:text-red-400 opacity-50 hover:opacity-100 transition-opacity"
                    title="削除"
                  >
                    <RiCloseLine />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* --- タグ管理（名称変更 / 削除） --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-medium text-text-main">
            <RiPriceTag3Line className="text-accent" />
            <h3>タグデータベース</h3>
          </div>
          <div className="relative">
            <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="タグを検索..."
              value={tagSearch}
              onChange={(e) => setTagSearch(e.target.value)}
              className="bg-bg-panel border border-border rounded-lg py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:border-accent/50 w-48"
            />
          </div>
        </div>

        {/* Progress Bar */}
        {progress && (
          <div className="bg-bg-panel border border-border rounded-lg p-3 text-sm animate-pulse">
            <div className="flex justify-between mb-1 text-text-muted">
              <span>{progress.message}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-200"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="bg-bg-panel border border-border rounded-xl overflow-hidden min-h-[300px] flex flex-col">
          {isLoadingTags ? (
            <div className="flex-1 flex items-center justify-center text-accent">
              <RiLoader4Line className="animate-spin text-3xl" />
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-dim opacity-60">
              <p>タグが見つかりません。</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto max-h-[500px] scrollbar-thin">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-bg-surface sticky top-0 z-10 text-xs uppercase text-text-muted font-medium border-b border-border">
                  <tr>
                    <th className="px-4 py-3">タグ名</th>
                    <th className="px-4 py-3 w-24 text-center">件数</th>
                    <th className="px-4 py-3 w-32 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredTags.map((tag) => (
                    <tr key={tag.name} className="group hover:bg-bg-surface/50 transition-colors">
                      <td className="px-4 py-2">
                        {editingTag === tag.name ? (
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim">#</span>
                            <input
                              type="text"
                              value={renameInput}
                              onChange={(e) => setRenameInput(e.target.value)}
                              className="bg-bg-surface border border-accent rounded px-2 py-1 text-text-main focus:outline-none w-full max-w-[200px]"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void executeRename(tag.name);
                                if (e.key === 'Escape') cancelRename();
                              }}
                            />
                            <button
                              onClick={() => void executeRename(tag.name)}
                              className="text-accent hover:bg-accent/10 p-1 rounded"
                              title="適用"
                            >
                              <RiCheckLine />
                            </button>
                            <button
                              onClick={cancelRename}
                              className="text-text-dim hover:bg-red-500/10 hover:text-red-500 p-1 rounded"
                              title="キャンセル"
                            >
                              <RiCloseLine />
                            </button>
                          </div>
                        ) : (
                          <div className="font-medium text-text-main">
                            <span className="text-accent/60 mr-0.5">#</span>
                            {tag.name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center text-text-dim font-mono text-xs">{tag.count}</td>
                      <td className="px-4 py-2 text-right">
                        {!editingTag && !progress && (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startRename(tag.name)}
                              className="p-1.5 text-text-dim hover:text-text-main hover:bg-bg-surface rounded transition-colors"
                              title="名前を変更"
                            >
                              <RiEdit2Line />
                            </button>
                            <button
                              onClick={() => void executeDelete(tag.name)}
                              className="p-1.5 text-text-dim hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                              title="削除"
                            >
                              <RiDeleteBinLine />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
