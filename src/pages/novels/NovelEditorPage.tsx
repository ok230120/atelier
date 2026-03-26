// FILE: src/pages/novels/NovelEditorPage.tsx (更新版 - シリーズ選択追加)
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiSaveLine,
  RiArrowLeftLine,
  RiImageAddLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
} from 'react-icons/ri';
import { db } from '../../db/schema';
import type { Novel, QuadrantSetting } from '../../types/domain';
import { parseNovel } from '../../utils/novelParser';
import { compressImage } from '../../utils/imageCompressor';
import TagChip from '../../components/TagChip';
import QuadrantSettingEditor from './components/QuadrantSettingEditor';

const NovelEditorPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  // シリーズ一覧を取得
  const allSeries = useLiveQuery(() => db.series.toArray(), []) || [];

  // フォーム状態
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [thumbnail, setThumbnail] = useState<string | undefined>();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [seriesId, setSeriesId] = useState<string | undefined>();
  const [quadrantSettings, setQuadrantSettings] = useState<QuadrantSetting[]>([]);

  // UI状態
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPage, setPreviewPage] = useState(0);
  const [currentStep, setCurrentStep] = useState<'basic' | 'content' | 'staging'>('basic');

  // 既存データの読み込み
  useEffect(() => {
    if (isEditMode && id) {
      setLoading(true);
      db.novels.get(id).then((novel) => {
        if (novel) {
          setTitle(novel.title);
          setSummary(novel.summary);
          setContent(novel.content);
          setThumbnail(novel.thumbnail);
          setTags(novel.tags);
          setFavorite(novel.favorite);
          setSeriesId(novel.seriesId);
          setQuadrantSettings(novel.quadrantSettings);
        }
        setLoading(false);
      });
    }
  }, [id, isEditMode]);

  // サムネイルアップロード
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressImage(file, 800, 600, 0.85);
      setThumbnail(dataUrl);
    } catch (error) {
      console.error('Failed to compress thumbnail:', error);
      alert('サムネイルの圧縮に失敗しました');
    }
  };

  // タグ追加
  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  // タグ削除
  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // 保存
  const handleSave = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }
    if (!content.trim()) {
      alert('本文を入力してください');
      return;
    }

    setSaving(true);
    try {
      const { pages, wordCount } = parseNovel(content);

      if (isEditMode && id) {
        // 更新
        const existing = await db.novels.get(id);
        if (!existing) {
          alert('小説が見つかりません');
          setSaving(false);
          return;
        }

        // タグの差分を計算
        const oldTags = existing.tags;
        const newTags = tags.map(t => t.toLowerCase());
        const removed = oldTags.filter(t => !newTags.includes(t));
        const added = newTags.filter(t => !oldTags.includes(t));

        // 削除されたタグのカウントを減らす
        for (const tag of removed) {
          const tagId = `novel:${tag}`;
          const existingTag = await db.tags.get(tagId);
          if (existingTag && existingTag.count > 0) {
            await db.tags.update(tagId, { count: existingTag.count - 1 });
          }
        }

        // 追加されたタグのカウントを増やす
        for (const tag of added) {
          const tagId = `novel:${tag}`;
          const existingTag = await db.tags.get(tagId);
          if (existingTag) {
            await db.tags.update(tagId, { count: existingTag.count + 1 });
          } else {
            await db.tags.add({
              id: tagId,
              category: 'novel',
              name: tag,
              count: 1,
            });
          }
        }

        // シリーズの更新処理
        const oldSeriesId = existing.seriesId;
        if (oldSeriesId !== seriesId) {
          // 古いシリーズから削除
          if (oldSeriesId) {
            const oldSeries = await db.series.get(oldSeriesId);
            if (oldSeries) {
              const updatedNovelIds = oldSeries.novelIds.filter(nid => nid !== id);
              await db.series.update(oldSeriesId, { novelIds: updatedNovelIds });
            }
          }
          // 新しいシリーズに追加
          if (seriesId) {
            const newSeries = await db.series.get(seriesId);
            if (newSeries) {
              const updatedNovelIds = [...newSeries.novelIds, id];
              await db.series.update(seriesId, { novelIds: updatedNovelIds });
            }
          }
        }

        await db.novels.update(id, {
          title,
          summary,
          content,
          pages,
          pageCount: pages.length,
          thumbnail,
          wordCount,
          tags: newTags,
          favorite,
          seriesId,
          quadrantSettings,
          previousVersion: {
            content: existing.content,
            savedAt: Date.now(),
          },
        });
      } else {
        // 新規作成
        const novelId = crypto.randomUUID();
        const novel: Novel = {
          id: novelId,
          title,
          summary,
          content,
          pages,
          pageCount: pages.length,
          thumbnail,
          wordCount,
          tags: tags.map(t => t.toLowerCase()),
          favorite,
          seriesId,
          quadrantSettings,
          addedAt: Date.now(),
          readCount: 0,
        };
        await db.novels.add(novel);

        // タグカウントの更新
        for (const tag of novel.tags) {
          const tagId = `novel:${tag}`;
          const existing = await db.tags.get(tagId);
          if (existing) {
            await db.tags.update(tagId, { count: existing.count + 1 });
          } else {
            await db.tags.add({
              id: tagId,
              category: 'novel',
              name: tag,
              count: 1,
            });
          }
        }

        // シリーズに追加
        if (seriesId) {
          const series = await db.series.get(seriesId);
          if (series) {
            const updatedNovelIds = [...series.novelIds, novelId];
            await db.series.update(seriesId, { novelIds: updatedNovelIds });
          }
        }
      }

      navigate('/novels');
    } catch (error) {
      console.error('Failed to save novel:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // プレビュー用の文字数・ページ数計算
  const previewStats = parseNovel(content);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-dim">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/novels')}
            className="p-2 rounded-xl hover:bg-bg-surface text-text-muted hover:text-text-main transition-colors"
          >
            <RiArrowLeftLine className="text-xl" />
          </button>
          <div>
            <h2 className="font-heading text-2xl font-bold">
              {isEditMode ? 'Edit Novel' : 'New Novel'}
            </h2>
            {previewStats.wordCount > 0 && (
              <p className="text-text-dim text-sm mt-1">
                {previewStats.wordCount.toLocaleString()} characters · {previewStats.pages.length} {previewStats.pages.length === 1 ? 'page' : 'pages'}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 bg-bg-panel border border-border rounded-xl text-text-main hover:border-accent/50 transition-colors flex items-center gap-2"
          >
            {showPreview ? <RiEyeOffLine /> : <RiEyeLine />}
            <span className="text-sm">{showPreview ? 'Hide' : 'Preview'}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-accent border border-accent/50 rounded-xl text-white hover:bg-accent/90 transition-colors flex items-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-50"
          >
            <RiSaveLine />
            <span className="text-sm font-medium">{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex border-b border-border">
        {(['basic', 'content', 'staging'] as const).map((step) => (
          <button
            key={step}
            onClick={() => setCurrentStep(step)}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              currentStep === step
                ? 'text-accent border-b-2 border-accent'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {step === 'basic' && '1. Basic Info'}
            {step === 'content' && '2. Content'}
            {step === 'staging' && '3. Staging'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 'basic' && (
            <>
              {/* タイトル */}
              <div>
                <label className="block font-body text-sm font-medium text-text-main mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter novel title..."
                  className="w-full bg-bg-panel border border-border text-text-main rounded-xl px-4 py-3 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50"
                />
              </div>

              {/* シリーズ選択 */}
              <div>
                <label className="block font-body text-sm font-medium text-text-main mb-2">
                  Series (Optional)
                </label>
                <select
                  value={seriesId || ''}
                  onChange={(e) => setSeriesId(e.target.value || undefined)}
                  className="w-full bg-bg-panel border border-border text-text-main rounded-xl px-4 py-3 focus:outline-none focus:border-accent/50 cursor-pointer"
                >
                  <option value="">No Series</option>
                  {allSeries.map((series) => (
                    <option key={series.id} value={series.id}>
                      {series.name}
                    </option>
                  ))}
                </select>
                {allSeries.length === 0 && (
                  <p className="text-xs text-text-dim mt-2">
                    シリーズがありません。管理ページで作成できます。
                  </p>
                )}
              </div>

              {/* あらすじ */}
              <div>
                <label className="block font-body text-sm font-medium text-text-main mb-2">
                  Summary
                </label>
                <div className="relative">
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Enter summary (3 lines recommended)..."
                    rows={4}
                    className="w-full bg-bg-panel border border-border text-text-main rounded-xl px-4 py-3 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 resize-none"
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-text-dim">
                    {summary.split('\n').length} / 3 lines
                  </div>
                </div>
              </div>

              {/* サムネイル */}
              <div>
                <label className="block font-body text-sm font-medium text-text-main mb-2">
                  Thumbnail
                </label>
                <div className="flex items-start gap-4">
                  {thumbnail && (
                    <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-border">
                      <img src={thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setThumbnail(undefined)}
                        className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors"
                      >
                        <RiDeleteBinLine className="text-white text-sm" />
                      </button>
                    </div>
                  )}
                  <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed border-border rounded-xl hover:border-accent/50 transition-colors cursor-pointer">
                    <RiImageAddLine className="text-3xl text-text-dim mb-2" />
                    <span className="text-sm text-text-muted">Upload Thumbnail</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* タグ */}
              <div>
                <label className="block font-body text-sm font-medium text-text-main mb-2">Tags</label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="flex-1 bg-bg-panel border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-accent border border-accent/50 rounded-xl text-white hover:bg-accent/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <TagChip
                      key={tag}
                      label={tag}
                      isSelected
                      onRemove={(e) => {
                        e.stopPropagation();
                        handleRemoveTag(tag);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* お気に入り */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="favorite"
                  checked={favorite}
                  onChange={(e) => setFavorite(e.target.checked)}
                  className="w-5 h-5 rounded border-border focus:ring-accent"
                />
                <label htmlFor="favorite" className="font-body text-sm text-text-main cursor-pointer">
                  Mark as Favorite
                </label>
              </div>
            </>
          )}

          {/* Step 2: Content */}
          {currentStep === 'content' && (
            <div>
              <label className="block font-body text-sm font-medium text-text-main mb-2">
                Content * <span className="text-text-dim text-xs">(Use [nextpage] to split pages)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your novel content here...

Use [nextpage] to split into pages.

Example:
First page content...

[nextpage]

Second page content..."
                rows={20}
                className="w-full bg-bg-panel border border-border text-text-main rounded-xl px-4 py-3 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 resize-y font-body"
              />
              {showPreview && content && (
                <div className="mt-4 p-6 bg-bg-surface border border-border rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-heading text-sm font-semibold text-text-main">
                      Preview: Page {previewPage + 1} / {previewStats.pages.length}
                    </h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                        disabled={previewPage === 0}
                        className="px-3 py-1 bg-bg-panel border border-border rounded-lg text-text-main text-xs hover:border-accent/50 disabled:opacity-30"
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => setPreviewPage(Math.min(previewStats.pages.length - 1, previewPage + 1))}
                        disabled={previewPage >= previewStats.pages.length - 1}
                        className="px-3 py-1 bg-bg-panel border border-border rounded-lg text-text-main text-xs hover:border-accent/50 disabled:opacity-30"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                  <div className="p-6 bg-bg-panel rounded-lg max-h-96 overflow-y-auto">
                    <div className="font-body text-text-main whitespace-pre-wrap leading-relaxed" style={{ fontSize: '16px', lineHeight: 1.8 }}>
                      {previewStats.pages[previewPage]}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Staging (演出設定) */}
          {currentStep === 'staging' && (
            <QuadrantSettingEditor
              settings={quadrantSettings}
              onChange={setQuadrantSettings}
              totalWordCount={previewStats.wordCount}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default NovelEditorPage;