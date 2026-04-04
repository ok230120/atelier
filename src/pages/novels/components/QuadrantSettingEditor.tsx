// FILE: src/pages/novels/components/QuadrantSettingEditor.tsx
import React, { useState } from 'react';
import {
  RiImageAddLine,
  RiDeleteBinLine,
  RiAddLine,
  RiImageLine,
  RiLinkM,
} from 'react-icons/ri';
import type { QuadrantSetting } from '../../../types/domain';
import { compressImage } from '../../../utils/imageCompressor';

interface QuadrantSettingEditorProps {
  settings: QuadrantSetting[];
  onChange: (settings: QuadrantSetting[]) => void;
  totalWordCount: number;
}

const QuadrantSettingEditor: React.FC<QuadrantSettingEditorProps> = ({
  settings,
  onChange,
  totalWordCount,
}) => {
  const [newSetting, setNewSetting] = useState<Partial<QuadrantSetting>>({
    slot: 'LT',
    startChar: 0,
    endChar: 100,
    imageType: 'dataUrl',
  });
  const [urlInput, setUrlInput] = useState('');

  // 画像アップロード（dataUrl）
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressImage(file, 1920, 1080, 0.85);
      setNewSetting({ ...newSetting, imageDataUrl: dataUrl, imageType: 'dataUrl' });
    } catch (error) {
      console.error('Failed to compress image:', error);
      alert('画像の圧縮に失敗しました');
    }
  };

  // URLから画像を取得
  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    try {
      // URLの検証
      new URL(urlInput);
      setNewSetting({ ...newSetting, imageUrl: urlInput, imageType: 'url' });
      setUrlInput('');
    } catch {
      alert('有効なURLを入力してください');
    }
  };

  // 設定を追加
  const handleAddSetting = () => {
    if (
      !newSetting.slot ||
      newSetting.startChar === undefined ||
      newSetting.endChar === undefined ||
      (!newSetting.imageDataUrl && !newSetting.imageUrl)
    ) {
      alert('すべてのフィールドを入力してください');
      return;
    }

    if (newSetting.startChar >= newSetting.endChar) {
      alert('開始位置は終了位置より小さくしてください');
      return;
    }

    onChange([...settings, newSetting as QuadrantSetting]);
    setNewSetting({
      slot: 'LT',
      startChar: 0,
      endChar: 100,
      imageType: 'dataUrl',
    });
  };

  // 設定を削除
  const handleRemoveSetting = (index: number) => {
    onChange(settings.filter((_, i) => i !== index));
  };

  const slotLabels: Record<string, string> = {
    LT: 'Left Top',
    LB: 'Left Bottom',
    RT: 'Right Top',
    RB: 'Right Bottom',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-heading text-lg font-semibold text-text-main mb-2">
          Quadrant Staging Settings
        </h3>
        <p className="text-sm text-text-dim">
          Set images for each quadrant based on character position. Total characters: {totalWordCount}
        </p>
      </div>

      {/* 既存の設定一覧 */}
      {settings.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-body text-sm font-medium text-text-main">Current Settings</h4>
          {settings.map((setting, index) => (
            <div
              key={index}
              className="flex items-center gap-4 p-4 bg-bg-panel border border-border rounded-xl"
            >
              <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-bg-surface">
                {setting.imageType === 'dataUrl' && setting.imageDataUrl ? (
                  <img
                    src={setting.imageDataUrl}
                    alt={`${setting.slot} preview`}
                    className="w-full h-full object-cover"
                  />
                ) : setting.imageType === 'url' && setting.imageUrl ? (
                  <img
                    src={setting.imageUrl}
                    alt={`${setting.slot} preview`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <RiImageLine className="text-text-dim" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="font-body text-sm font-medium text-text-main">
                  {slotLabels[setting.slot]}
                </div>
                <div className="text-xs text-text-dim mt-1">
                  Characters {setting.startChar} - {setting.endChar}
                </div>
                <div className="text-xs text-text-dim">
                  {setting.imageType === 'url' ? '🔗 URL' : '📁 Uploaded'}
                </div>
              </div>
              <button
                onClick={() => handleRemoveSetting(index)}
                className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <RiDeleteBinLine />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 新規設定追加 */}
      <div className="p-6 bg-bg-surface border border-border rounded-2xl space-y-4">
        <h4 className="font-body text-sm font-medium text-text-main">Add New Setting</h4>

        {/* スロット選択 */}
        <div>
          <label className="block text-xs text-text-muted mb-2">Quadrant</label>
          <select
            value={newSetting.slot}
            onChange={(e) => setNewSetting({ ...newSetting, slot: e.target.value as any })}
            className="w-full bg-bg-panel border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50"
          >
            <option value="LT">Left Top</option>
            <option value="LB">Left Bottom</option>
            <option value="RT">Right Top</option>
            <option value="RB">Right Bottom</option>
          </select>
        </div>

        {/* 文字位置範囲 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-text-muted mb-2">Start Character</label>
            <input
              type="number"
              value={newSetting.startChar}
              onChange={(e) => setNewSetting({ ...newSetting, startChar: Number(e.target.value) })}
              min={0}
              max={totalWordCount}
              className="w-full bg-bg-panel border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-2">End Character</label>
            <input
              type="number"
              value={newSetting.endChar}
              onChange={(e) => setNewSetting({ ...newSetting, endChar: Number(e.target.value) })}
              min={0}
              max={totalWordCount}
              className="w-full bg-bg-panel border border-border text-text-main rounded-xl px-4 py-2 focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* 画像設定 */}
        <div>
          <label className="block text-xs text-text-muted mb-2">Image</label>
          <div className="space-y-3">
            {/* アップロード */}
            <label className="flex items-center justify-center h-24 border-2 border-dashed border-border rounded-xl hover:border-accent/50 transition-colors cursor-pointer">
              <div className="text-center">
                <RiImageAddLine className="text-2xl text-text-dim mx-auto mb-1" />
                <span className="text-xs text-text-muted">Upload Image</span>
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>

            {/* URL入力 */}
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Or enter image URL..."
                className="flex-1 bg-bg-panel border border-border text-text-main rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={handleUrlSubmit}
                className="px-4 py-2 bg-bg-panel border border-border rounded-xl text-text-main hover:border-accent/50 transition-colors"
              >
                <RiLinkM />
              </button>
            </div>

            {/* プレビュー */}
            {(newSetting.imageDataUrl || newSetting.imageUrl) && (
              <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border">
                <img
                  src={newSetting.imageDataUrl || newSetting.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>
        </div>

        {/* 追加ボタン */}
        <button
          onClick={handleAddSetting}
          className="w-full px-4 py-2 bg-accent border border-accent/50 rounded-xl text-white hover:bg-accent/90 transition-colors flex items-center justify-center gap-2"
        >
          <RiAddLine />
          <span className="text-sm font-medium">Add Setting</span>
        </button>
      </div>
    </div>
  );
};

export default QuadrantSettingEditor;
