// FILE: src/pages/videos/components/FavoriteToggleButton.tsx
import React, { useState } from 'react';
import { RiHeart3Fill, RiHeart3Line } from 'react-icons/ri';
import { db } from '../../../db/client';

type Props = {
  videoId: string;
  favorite: boolean;
  className?: string;
};

const FavoriteToggleButton: React.FC<Props> = ({ videoId, favorite, className }) => {
  const [busy, setBusy] = useState(false);

  const onClick: React.MouseEventHandler<HTMLButtonElement> = async (e) => {
    // Cardクリック（遷移）を止める
    e.preventDefault();
    e.stopPropagation();

    if (busy) return;
    setBusy(true);
    try {
      await db.videos.update(videoId, { favorite: !favorite });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={favorite ? 'Unfavorite' : 'Favorite'}
      title={favorite ? 'Unfavorite' : 'Favorite'}
      className={[
        // ✅ 四角い囲いの原因（border/bg/rounded-xl）をやめて「丸」にする
        'inline-flex items-center justify-center rounded-full border-0 shadow-none',
        // ✅ 元のVideoCardと同じ見た目（丸い黒背景 + ぼかし + ちょうどいい余白）
        'bg-black/60 p-1.5 backdrop-blur-sm',
        // ✅ フォーカス時の四角いアウトラインも消す（必要なら後で丸リングにできる）
        'outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
        // ✅ disabled表現
        busy ? 'opacity-60 cursor-not-allowed' : '',
        // ✅ 非favは「ホバーで出る」挙動を維持（VideoCardの group-hover が効く）
        favorite
          ? 'text-red-500'
          : 'text-white opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400',
        className ?? '',
      ].join(' ')}
    >
      {favorite ? (
        <RiHeart3Fill className="text-lg" />
      ) : (
        <RiHeart3Line className="text-lg" />
      )}
    </button>
  );
};

export default FavoriteToggleButton;
