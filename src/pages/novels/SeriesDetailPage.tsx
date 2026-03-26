// FILE: src/pages/novels/SeriesDetailPage.tsx
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  RiArrowLeftLine,
  RiEditLine,
  RiBookOpenLine,
  RiLoader4Line,
} from 'react-icons/ri';
import { db } from '../../db/schema';
import NovelCard from './components/NovelCard';

const SeriesDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const series = useLiveQuery(() => (id ? db.series.get(id) : undefined), [id]);
  const allNovels = useLiveQuery(() => db.novels.toArray(), []);

  if (!series || !allNovels) {
    return (
      <div className="flex items-center justify-center h-full">
        <RiLoader4Line className="animate-spin text-4xl text-accent" />
      </div>
    );
  }

  // シリーズ内の小説を順番通りに取得
  const novels = series.novelIds
    .map((novelId) => allNovels.find((n) => n.id === novelId))
    .filter((n) => n !== undefined);

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
            <h2 className="font-heading text-2xl font-bold">{series.name}</h2>
            {series.description && (
              <p className="text-text-muted text-sm mt-1">{series.description}</p>
            )}
            <p className="text-text-dim text-xs mt-1">{novels.length} novels in this series</p>
          </div>
        </div>

        <Link
          to="/novels/manage"
          className="px-4 py-2 bg-bg-panel border border-border rounded-xl text-text-main hover:border-accent/50 transition-colors flex items-center gap-2"
        >
          <RiEditLine />
          <span className="text-sm">Manage Series</span>
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {novels.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-dim border-2 border-dashed border-border/50 rounded-2xl">
            <RiBookOpenLine className="text-5xl opacity-20 mb-4" />
            <p className="text-lg font-medium">No novels in this series yet</p>
            <p className="text-sm mt-2 opacity-60">Add novels from the management page.</p>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {novels.map((novel, index) => (
                <div key={novel.id} className="relative">
                  {/* 巻数表示 */}
                  <div className="absolute -top-2 -left-2 z-10 w-8 h-8 bg-accent rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg">
                    {index + 1}
                  </div>
                  <NovelCard novel={novel} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SeriesDetailPage;