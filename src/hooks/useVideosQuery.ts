import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/client';
import { Video } from '../types/domain';

interface UseVideosQueryProps {
  searchText?: string;
  tags?: string[];
  mountId?: string;
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'popular'; // TODO: popular not fully implemented yet
}

interface UseVideosQueryResult {
  videos: Video[];
  totalCount: number;
  isLoading: boolean;
  error?: Error;
}

export const useVideosQuery = ({
  searchText = '',
  tags = [],
  mountId,
  page = 1,
  pageSize = 20,
  sort = 'newest'
}: UseVideosQueryProps): UseVideosQueryResult => {
  
  // Normalize search text
  const normalizedSearch = searchText.toLowerCase().trim();

  // useLiveQuery to reactively fetch data from Dexie
  const result = useLiveQuery(async () => {
    let collection = db.videos.toCollection();

    // 1. Filtering (Naive implementation for now - simple AND logic)
    // Dexie's compound indexing capability is limited for ad-hoc queries, 
    // so we apply filter in JS for search/tags if needed, or use where clauses if possible.
    
    // If mountId is specified, filter by it first (indexed)
    if (mountId) {
      collection = db.videos.where('mountId').equals(mountId);
    } else {
      // Default ordering by addedAt (descending for 'newest')
      collection = db.videos.orderBy('addedAt');
    }

    // Apply sorting direction
    if (sort === 'newest') {
      collection = collection.reverse();
    }
    // TODO: Implement other sort modes

    // Apply in-memory filtering for search text and tags
    // NOTE: For large datasets, this might need optimization using Dexie's text search addons or better indexing strategies.
    let filteredCollection = collection.filter(video => {
      // Filter by Tags (AND logic)
      if (tags.length > 0) {
        const hasAllTags = tags.every(t => video.tags.includes(t));
        if (!hasAllTags) return false;
      }

      // Filter by Search Text
      if (normalizedSearch) {
        const titleMatch = (video.titleOverride || video.filename).toLowerCase().includes(normalizedSearch);
        // Simple tag match in search text
        const tagMatch = video.tags.some(t => t.toLowerCase().includes(normalizedSearch));
        if (!titleMatch && !tagMatch) return false;
      }

      return true;
    });

    // Count total before pagination
    const totalCount = await filteredCollection.count();

    // Apply Pagination
    const offset = (page - 1) * pageSize;
    const videos = await filteredCollection.offset(offset).limit(pageSize).toArray();

    return {
      videos,
      totalCount
    };
  }, [searchText, tags, mountId, page, pageSize, sort]);

  return {
    videos: result?.videos || [],
    totalCount: result?.totalCount || 0,
    isLoading: !result,
  };
};