import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';
import { useImageTaggingSession } from '../../hooks/useImageTaggingSession';
import ImageTaggingEditor from './components/ImageTaggingEditor';
import ImageTaggingQueue from './components/ImageTaggingQueue';

export default function ImageTaggingPage() {
  const navigate = useNavigate();
  const session = useImageTaggingSession();

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
          <ImageTaggingQueue
            items={session.queue}
            selectedImageId={session.selectedImageId}
            onSelect={session.selectImage}
          />
          <ImageTaggingEditor
            detail={session.detail}
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
