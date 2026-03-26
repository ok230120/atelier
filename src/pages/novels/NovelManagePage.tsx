// FILE: src/pages/novels/NovelManagePage.tsx
import React, { useState } from 'react';
import { RiPriceTag3Line, RiArrowLeftLine, RiBookmarkLine } from 'react-icons/ri';
import { useNavigate } from 'react-router-dom';
import TagManager from './components/TagManager';
import SeriesManager from './components/SeriesManager';

const NovelManagePage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tags' | 'series'>('tags');

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
            <h2 className="font-heading text-2xl font-bold">Novel Management</h2>
            <p className="text-text-dim text-sm mt-1">Manage tags and series</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('tags')}
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'tags'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <RiPriceTag3Line />
          Tag Management
        </button>
        <button
          onClick={() => setActiveTab('series')}
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            activeTab === 'series'
              ? 'text-accent border-b-2 border-accent'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <RiBookmarkLine />
          Series Management
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'tags' && <TagManager />}
          {activeTab === 'series' && <SeriesManager />}
        </div>
      </div>
    </div>
  );
};

export default NovelManagePage;