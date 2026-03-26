// FILE: src/pages/novels/NovelReaderPage.tsx (更新版)
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiEyeLine,
  RiEyeOffLine,
  RiEditLine,
  RiCloseLine,
} from 'react-icons/ri';
import { db } from '../../db/schema';
import type { Novel } from '../../types/domain';
import { calculateCharIndex, getActiveQuadrantSettings } from '../../utils/novelParser';
import QuadrantSlot from './components/QuadrantSlot';
import NovelContent from './components/NovelContent';
import { useAppSettings } from '../../hooks/useAppSettings';

const NovelReaderPage: React.FC = () => {
  const { id, page } = useParams<{ id: string; page: string }>();
  const navigate = useNavigate();
  const settings = useAppSettings();

  const [novel, setNovel] = useState<Novel | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuadrants, setShowQuadrants] = useState(settings.novelShowQuadrants ?? true);

  const currentPage = parseInt(page || '1', 10);

  // 小説データの読み込み
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    db.novels.get(id).then((data) => {
      if (data) {
        setNovel(data);
        // 閲覧記録を更新
        db.novels.update(id, {
          lastReadAt: Date.now(),
          readCount: (data.readCount || 0) + 1,
        });
      }
      setLoading(false);
    });
  }, [id]);

  // 現在の文字インデックスを計算
  const currentCharIndex = useMemo(() => {
    if (!novel) return 0;
    return calculateCharIndex(novel.pages, currentPage - 1);
  }, [novel, currentPage]);

  // アクティブな演出設定を取得
  const activeQuadrants = useMemo(() => {
    if (!novel) {
      return { LT: null, LB: null, RT: null, RB: null };
    }
    return getActiveQuadrantSettings(currentCharIndex, novel.quadrantSettings);
  }, [novel, currentCharIndex]);

  // 使用されているスロットを判定
  const usedSlots = useMemo(() => {
    const slots = { left: false, right: false };
    if (activeQuadrants.LT || activeQuadrants.LB) {
      slots.left = true;
    }
    if (activeQuadrants.RT || activeQuadrants.RB) {
      slots.right = true;
    }
    return slots;
  }, [activeQuadrants]);

  // レイアウトモードの決定
  const layoutMode = useMemo(() => {
    if (!showQuadrants) return 'center-only';
    if (usedSlots.left && usedSlots.right) return 'both';
    if (usedSlots.left) return 'left-only';
    if (usedSlots.right) return 'right-only';
    return 'center-only';
  }, [showQuadrants, usedSlots]);

  // ページ遷移
  const goToPage = (newPage: number) => {
    if (!novel) return;
    if (newPage < 1 || newPage > novel.pageCount) return;
    navigate(`/novels/${id}/${newPage}`);
  };

  // キーボード操作
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
      } else if (e.key === 'Escape') {
        navigate('/novels');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, novel]);

  // 演出スロット表示/非表示の切り替えを設定に保存
  const toggleQuadrants = async () => {
    const newValue = !showQuadrants;
    setShowQuadrants(newValue);
    await db.settings.update('app', { novelShowQuadrants: newValue });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-dim">Loading...</div>
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-text-dim mb-4">Novel not found</div>
        <button
          onClick={() => navigate('/novels')}
          className="px-4 py-2 bg-accent rounded-xl text-white hover:bg-accent/90 transition-colors"
        >
          Back to Novels
        </button>
      </div>
    );
  }

  const currentPageContent = novel.pages[currentPage - 1] || '';

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-panel">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/novels')}
            className="p-2 rounded-xl hover:bg-bg-surface text-text-muted hover:text-text-main transition-colors"
            title="Back to Novels (Esc)"
          >
            <RiCloseLine className="text-xl" />
          </button>
          <div>
            <h2 className="font-heading text-lg font-semibold text-text-main">{novel.title}</h2>
            <p className="text-xs text-text-dim">
              Page {currentPage} / {novel.pageCount}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleQuadrants}
            className="px-3 py-2 bg-bg-surface border border-border rounded-xl text-text-main hover:border-accent/50 transition-colors flex items-center gap-2"
            title="Toggle Staging Slots"
          >
            {showQuadrants ? <RiEyeOffLine /> : <RiEyeLine />}
            <span className="text-sm hidden sm:inline">
              {showQuadrants ? 'Hide' : 'Show'} Staging
            </span>
          </button>
          <button
            onClick={() => navigate(`/novels/edit/${id}`)}
            className="px-3 py-2 bg-bg-surface border border-border rounded-xl text-text-main hover:border-accent/50 transition-colors flex items-center gap-2"
            title="Edit Novel"
          >
            <RiEditLine />
            <span className="text-sm hidden sm:inline">Edit</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Quadrants */}
        {layoutMode === 'both' && (
          <div className="w-64 flex-shrink-0 flex flex-col border-r border-border">
            <QuadrantSlot
              slot="LT"
              activeSetting={activeQuadrants.LT}
              layoutMode="split"
            />
            <QuadrantSlot
              slot="LB"
              activeSetting={activeQuadrants.LB}
              layoutMode="split"
            />
          </div>
        )}

        {layoutMode === 'left-only' && (
          <div className="w-64 flex-shrink-0 border-r border-border">
            <QuadrantSlot
              slot="LT"
              activeSetting={activeQuadrants.LT || activeQuadrants.LB}
              layoutMode="full"
            />
          </div>
        )}

        {/* Center Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <NovelContent content={currentPageContent} fontSize={settings.novelFontSize || 16} />

          {/* Navigation */}
          <div className="flex items-center justify-between px-8 py-4 border-t border-border bg-bg-panel">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="px-4 py-2 bg-bg-surface border border-border rounded-xl text-text-main hover:border-accent/50 transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RiArrowLeftLine />
              <span className="text-sm">Previous</span>
            </button>

            <div className="text-sm text-text-muted">
              Page {currentPage} / {novel.pageCount}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= novel.pageCount}
              className="px-4 py-2 bg-bg-surface border border-border rounded-xl text-text-main hover:border-accent/50 transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="text-sm">Next</span>
              <RiArrowRightLine />
            </button>
          </div>
        </div>

        {/* Right Quadrants */}
        {layoutMode === 'both' && (
          <div className="w-64 flex-shrink-0 flex flex-col border-l border-border">
            <QuadrantSlot
              slot="RT"
              activeSetting={activeQuadrants.RT}
              layoutMode="split"
            />
            <QuadrantSlot
              slot="RB"
              activeSetting={activeQuadrants.RB}
              layoutMode="split"
            />
          </div>
        )}

        {layoutMode === 'right-only' && (
          <div className="w-64 flex-shrink-0 border-l border-border">
            <QuadrantSlot
              slot="RT"
              activeSetting={activeQuadrants.RT || activeQuadrants.RB}
              layoutMode="full"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default NovelReaderPage;