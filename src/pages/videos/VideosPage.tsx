import React, { useState } from 'react';
import { useVideosQuery } from '../../hooks/useVideosQuery';
import SearchBar from '../../components/SearchBar';
import Pagination from '../../components/Pagination';
import VideoCard from './components/VideoCard';
import { RiLoader4Line, RiMovieLine } from 'react-icons/ri';

const VideosPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Query videos from Dexie
  const { videos, totalCount, isLoading } = useVideosQuery({
    searchText,
    page: currentPage,
    pageSize,
    sort: 'newest'
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSearchChange = (val: string) => {
    setSearchText(val);
    setCurrentPage(1); // Reset to first page on search
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Page Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Library</h2>
          <p className="text-text-dim text-sm mt-1">
            {totalCount} videos stored locally
          </p>
        </div>
        
        <div className="w-full md:w-96">
          <SearchBar 
            value={searchText} 
            onChange={handleSearchChange}
            placeholder="Search by title or #tag..." 
          />
        </div>
      </div>

      {/* TODO: Tag Row & Mount Filters will go here */}

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-accent">
            <RiLoader4Line className="animate-spin text-4xl" />
          </div>
        ) : videos.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-text-dim border-2 border-dashed border-border/50 rounded-2xl">
            <RiMovieLine className="text-5xl opacity-20 mb-4" />
            <p className="text-lg font-medium">No videos found</p>
            {searchText ? (
              <p className="text-sm mt-2 opacity-60">Try adjusting your search terms</p>
            ) : (
              <p className="text-sm mt-2 opacity-60">Add folders in the Manage page to get started</p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {videos.map(video => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>

            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default VideosPage;