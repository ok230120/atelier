import React from 'react';
import { useParams, Link } from 'react-router-dom';

const VideoDetailPage: React.FC = () => {
  const { id } = useParams();

  return (
    <div className="max-w-4xl mx-auto py-8">
      <Link to="/videos" className="text-sm text-text-muted hover:text-accent mb-4 inline-block">&larr; Back to Library</Link>
      <div className="aspect-video bg-black rounded-xl border border-border flex items-center justify-center mb-6">
        <span className="text-text-dim">Player Placeholder (ID: {id})</span>
      </div>
      <h1 className="font-heading text-2xl font-bold mb-2">Video Title</h1>
      <div className="flex gap-2 text-sm text-text-dim">
        <span>Tags...</span>
      </div>
    </div>
  );
};

export default VideoDetailPage;
