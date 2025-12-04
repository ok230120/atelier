import React from 'react';

const FavoritesPage: React.FC = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center text-text-muted space-y-4">
      <div className="text-6xl opacity-20 font-heading">FAVORITES</div>
      <p>Your favorite videos will appear here.</p>
    </div>
  );
};

export default FavoritesPage;
