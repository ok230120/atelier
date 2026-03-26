// FILE: src/pages/novels/components/QuadrantSlot.tsx
import React from 'react';
import { RiImageLine } from 'react-icons/ri';
import type { QuadrantSetting } from '../../../types/domain';

interface QuadrantSlotProps {
  slot: 'LT' | 'LB' | 'RT' | 'RB';
  activeSetting: QuadrantSetting | null;
  layoutMode: 'split' | 'full'; // split = 上下2分割, full = 全体表示
}

const QuadrantSlot: React.FC<QuadrantSlotProps> = ({ slot, activeSetting, layoutMode }) => {
  // 表示する画像を決定（演出設定のみ）
  const imageSource = activeSetting
    ? activeSetting.imageType === 'dataUrl'
      ? activeSetting.imageDataUrl
      : activeSetting.imageUrl
    : undefined;

  const slotLabels: Record<string, string> = {
    LT: 'Left Top',
    LB: 'Left Bottom',
    RT: 'Right Top',
    RB: 'Right Bottom',
  };

  return (
    <div className={`${layoutMode === 'split' ? 'flex-1' : 'h-full'} relative bg-bg-surface overflow-hidden group`}>
      {imageSource ? (
        <img
          src={imageSource}
          alt={slotLabels[slot]}
          className="w-full h-full object-cover transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <RiImageLine className="text-4xl text-text-dim opacity-10" />
        </div>
      )}

      {/* ラベル（ホバー時に表示） */}
      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
        {layoutMode === 'full' ? slot.startsWith('L') ? 'Left' : 'Right' : slotLabels[slot]}
      </div>
    </div>
  );
};

export default QuadrantSlot;
