import { useNavigate } from 'react-router-dom';
import { RiArrowLeftLine } from 'react-icons/ri';

export default function ImageTaggingCompletedPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/images/tagging')}
          className="text-text-dim transition-colors hover:text-text-main"
          aria-label="Back to tagging"
        >
          <RiArrowLeftLine size={20} />
        </button>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-text-dim">
            Images / Tagging / Completed
          </p>
          <h1 className="font-heading text-2xl text-text-main">Completed</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-bg-panel px-6 py-16 text-center text-text-dim">
        v1 では完了履歴を永続化しません。タグ付け後の進行状態は、その場のセッション内でのみ管理します。
      </div>
    </div>
  );
}
