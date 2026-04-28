import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import Pagination from '../../components/Pagination';
import { useImageTaggingSession } from '../../hooks/useImageTaggingSession';
import ImageTaggingEditor from './components/ImageTaggingEditor';
import ImageTaggingQueue from './components/ImageTaggingQueue';

const PER_PAGE = 24;

export default function ImageTaggingPage() {
  const navigate = useNavigate();
  const session = useImageTaggingSession();
  const { hydrateQueueThumbnails } = session;
  const [queuePage, setQueuePage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(session.queue.length / PER_PAGE));
  const safePage = Math.min(queuePage, totalPages);
  const pageItems = useMemo(
    () => session.queue.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
    [safePage, session.queue],
  );
  const missingThumbnailIds = useMemo(
    () => pageItems.filter((item) => !item.thumbnail).map((item) => item.id),
    [pageItems],
  );
  const missingThumbnailIdsKey = useMemo(() => missingThumbnailIds.join(','), [missingThumbnailIds]);

  useEffect(() => {
    if (queuePage !== safePage) setQueuePage(safePage);
  }, [queuePage, safePage]);

  useEffect(() => {
    if (!missingThumbnailIdsKey) return;
    void hydrateQueueThumbnails(missingThumbnailIdsKey.split(','));
  }, [hydrateQueueThumbnails, missingThumbnailIdsKey]);

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)] flex-col px-6 py-4">
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/images')}
          className="text-text-dim transition-colors hover:text-text-main"
          aria-label="Back to images"
        >
          <RiArrowLeftLine size={20} />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-text-dim">Images / Tagging</p>
          <h1 className="font-heading text-2xl text-text-main">Tagging</h1>
        </div>
      </div>

      {session.loading ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-border bg-bg-panel text-text-dim">
          読み込み中...
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col">
            <ImageTaggingQueue
              items={pageItems}
              totalCount={session.queue.length}
              selectedImageId={session.selectedImageId}
              onSelect={session.selectImage}
            />
            {totalPages > 1 && (
              <div className="pb-2">
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={setQueuePage}
                />
              </div>
            )}
          </div>
          <ImageTaggingEditor
            detail={session.detail}
            detailLoading={session.detailLoading}
            categories={session.categories}
            allTags={session.allTags}
            recentTags={session.recentTags}
            busy={session.busy}
            error={session.error}
            onAddTag={session.addManualTag}
            onRemoveTag={session.removeManualTag}
            onCreateTag={session.createAndAddTag}
            onNext={session.goNext}
          />
        </div>
      )}
    </div>
  );
}
