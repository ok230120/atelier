import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ImageScope = 'all' | 'current';
export type ImageFolderDepth = 'direct' | 'tree';

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) return 1;
  return Math.max(1, parsed);
}

function normalizeTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function parseScope(value: string | null): ImageScope {
  return value === 'current' ? 'current' : 'all';
}

function parseFolderDepth(value: string | null): ImageFolderDepth {
  return value === 'tree' ? 'tree' : 'direct';
}

export function useImageListUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQS = searchParams.toString();
  const lastWrittenQSRef = useRef<string | null>(null);

  const [mountId, setMountIdState] = useState(() => searchParams.get('mount') ?? '');
  const [folder, setFolderState] = useState(() => searchParams.get('folder') ?? '');
  const [scope, setScopeState] = useState<ImageScope>(() => parseScope(searchParams.get('scope')));
  const [folderDepth, setFolderDepthState] = useState<ImageFolderDepth>(() =>
    parseFolderDepth(searchParams.get('depth')),
  );
  const [page, setPageState] = useState(() => parsePage(searchParams.get('page')));
  const [selectedTagIds, setSelectedTagIdsState] = useState<string[]>(() =>
    normalizeTags(searchParams.getAll('tag')),
  );

  const desiredQS = useMemo(() => {
    const params = new URLSearchParams();
    if (mountId) params.set('mount', mountId);
    if (folder) params.set('folder', folder);
    if (scope !== 'all') params.set('scope', scope);
    if (scope === 'current') params.set('depth', folderDepth);
    for (const tagId of normalizeTags(selectedTagIds)) params.append('tag', tagId);
    if (page !== 1) params.set('page', String(page));
    return params.toString();
  }, [folder, folderDepth, mountId, page, scope, selectedTagIds]);

  useEffect(() => {
    if (lastWrittenQSRef.current === currentQS) {
      lastWrittenQSRef.current = null;
      return;
    }

    setMountIdState(searchParams.get('mount') ?? '');
    setFolderState(searchParams.get('folder') ?? '');
    setScopeState(parseScope(searchParams.get('scope')));
    setFolderDepthState(parseFolderDepth(searchParams.get('depth')));
    setPageState(parsePage(searchParams.get('page')));
    setSelectedTagIdsState(normalizeTags(searchParams.getAll('tag')));
  }, [currentQS, searchParams]);

  useEffect(() => {
    if (desiredQS === currentQS) return;
    lastWrittenQSRef.current = desiredQS;
    setSearchParams(new URLSearchParams(desiredQS), { replace: true });
  }, [currentQS, desiredQS, setSearchParams]);

  const setPage = (nextPage: number) => setPageState(Math.max(1, nextPage));

  const setSelectedTagIds = (next: string[] | ((prev: string[]) => string[])) => {
    setSelectedTagIdsState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      return normalizeTags(resolved);
    });
    setPageState(1);
  };

  const setScope = (nextScope: ImageScope) => {
    setScopeState(nextScope);
    if (nextScope === 'current') setFolderDepthState('direct');
    setPageState(1);
  };

  const setFolderDepth = (nextDepth: ImageFolderDepth) => {
    setFolderDepthState(nextDepth);
    setPageState(1);
  };

  const navigateTo = (
    nextMountId: string,
    nextFolder: string,
    nextScope: ImageScope = nextMountId || nextFolder ? 'current' : 'all',
    nextFolderDepth: ImageFolderDepth = nextScope === 'current' ? 'direct' : folderDepth,
  ) => {
    setMountIdState(nextMountId);
    setFolderState(nextFolder);
    setScopeState(nextScope);
    setFolderDepthState(nextScope === 'current' ? nextFolderDepth : 'direct');
    setPageState(1);
  };

  const goHome = () => {
    navigateTo('', '', 'all');
  };

  return {
    mountId,
    folder,
    scope,
    folderDepth,
    page,
    selectedTagIds,
    setPage,
    setScope,
    setFolderDepth,
    setSelectedTagIds,
    navigateTo,
    goHome,
  };
}
