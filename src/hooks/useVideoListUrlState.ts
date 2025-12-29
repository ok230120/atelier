// FILE: src/hooks/useVideoListUrlState.ts
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function parsePage(v: string | null): number {
  const n = Number.parseInt(v ?? '1', 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return 1;
  return Math.max(1, n);
}

function parsePageSize(v: string | null): number {
  const n = Number.parseInt(v ?? '20', 10);
  if ([12, 20, 40].includes(n)) return n;
  return 20;
}

function sortedTags(tags: string[]): string[] {
  return Array.from(new Set(tags.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export type SortOption = 'newest' | 'oldest';
export type LenOption = 'any' | '0-5' | '5-10' | '10-30' | '30-60' | '60+';

export const DURATION_RANGES_SEC: Record<LenOption, [number | undefined, number | undefined]> = {
  any: [undefined, undefined],
  '0-5': [0, 300],
  '5-10': [300, 600],
  '10-30': [600, 1800],
  '30-60': [1800, 3600],
  '60+': [3600, undefined],
};

// 互換用（Gemini案がこの名前を使う可能性があるため）
export const DURATION_RANGES = DURATION_RANGES_SEC;

function parseSort(v: string | null): SortOption {
  return v === 'oldest' ? 'oldest' : 'newest';
}

function parseLen(v: string | null): LenOption {
  const cand = (v as LenOption) ?? 'any';
  return Object.prototype.hasOwnProperty.call(DURATION_RANGES_SEC, cand) ? cand : 'any';
}

export interface VideoListUrlState {
  searchText: string;
  selectedTags: string[];
  selectedMountId: string;
  currentPage: number;
  sortOrder: SortOption;
  pageSize: number;
  durationFilter: LenOption;
  minDurationSec?: number;
  maxDurationSec?: number;

  // setters (wrapped)
  setCurrentPage: (p: number) => void;
  setSearchText: (v: string) => void;

  // tag helpers (old API)
  toggleTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  clearAllTags: () => void;

  // mount helpers (old API)
  setSelectedMountId: (id: string) => void;
  clearMount: () => void;

  setSortOrder: (s: SortOption) => void;
  setPageSize: (n: number) => void;
  setDurationFilter: (l: LenOption) => void;

  // convenience (new-style API; non-breaking追加)
  setSelectedTags: (valOrFunc: string[] | ((prev: string[]) => string[])) => void;

  resetAll: () => void;
}

export function useVideoListUrlState(): VideoListUrlState {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentQS = searchParams.toString();
  const lastWrittenQSRef = useRef<string | null>(null);

  // --- init from URL ---
  const [searchText, _setSearchText] = useState<string>(() => searchParams.get('q') ?? '');
  const [selectedTags, _setSelectedTags] = useState<string[]>(() => sortedTags(searchParams.getAll('tag')));
  const [selectedMountId, _setSelectedMountId] = useState<string>(() => searchParams.get('m') ?? '');
  const [currentPage, _setCurrentPage] = useState<number>(() => parsePage(searchParams.get('p')));

  const [sortOrder, _setSortOrder] = useState<SortOption>(() => parseSort(searchParams.get('sort')));
  const [pageSize, _setPageSize] = useState<number>(() => parsePageSize(searchParams.get('ps')));
  const [durationFilter, _setDurationFilter] = useState<LenOption>(() => parseLen(searchParams.get('len')));

  const [minDurationSec, maxDurationSec] = DURATION_RANGES_SEC[durationFilter] ?? [undefined, undefined];

  // --- desired query string from state ---
  const desiredQS = useMemo(() => {
    const sp = new URLSearchParams();

    const q = searchText.trim();
    if (q) sp.set('q', q);

    for (const t of sortedTags(selectedTags)) sp.append('tag', t);

    if (selectedMountId) sp.set('m', selectedMountId);
    if (currentPage !== 1) sp.set('p', String(currentPage));

    if (sortOrder !== 'newest') sp.set('sort', sortOrder);
    if (pageSize !== 20) sp.set('ps', String(pageSize));
    if (durationFilter !== 'any') sp.set('len', durationFilter);

    return sp.toString();
  }, [searchText, selectedTags, selectedMountId, currentPage, sortOrder, pageSize, durationFilter]);

  // URL -> State (back/forward navigation)
  useEffect(() => {
    if (lastWrittenQSRef.current === currentQS) {
      lastWrittenQSRef.current = null;
      return;
    }

    const q = searchParams.get('q') ?? '';
    const tags = sortedTags(searchParams.getAll('tag'));
    const m = searchParams.get('m') ?? '';
    const p = parsePage(searchParams.get('p'));
    const s = parseSort(searchParams.get('sort'));
    const ps = parsePageSize(searchParams.get('ps'));
    const len = parseLen(searchParams.get('len'));

    if (q !== searchText) _setSearchText(q);

    const tagsEqual = tags.length === selectedTags.length && tags.every((t, i) => t === selectedTags[i]);
    if (!tagsEqual) _setSelectedTags(tags);

    if (m !== selectedMountId) _setSelectedMountId(m);
    if (p !== currentPage) _setCurrentPage(p);
    if (s !== sortOrder) _setSortOrder(s);
    if (ps !== pageSize) _setPageSize(ps);
    if (len !== durationFilter) _setDurationFilter(len);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQS]);

  // State -> URL
  useEffect(() => {
    if (desiredQS === currentQS) return;
    lastWrittenQSRef.current = desiredQS;
    setSearchParams(new URLSearchParams(desiredQS), { replace: true });
  }, [desiredQS, currentQS, setSearchParams]);

  // --- wrapped setters ---
  const setCurrentPage = (p: number) => _setCurrentPage(Math.max(1, p));

  const setSearchText = (v: string) => {
    _setSearchText(v);
    _setCurrentPage(1);
  };

  // new-style: setSelectedTags（互換追加）
  const setSelectedTags = (valOrFunc: string[] | ((prev: string[]) => string[])) => {
    _setSelectedTags((prev) => {
      const next = typeof valOrFunc === 'function' ? valOrFunc(prev) : valOrFunc;
      return sortedTags(next);
    });
    _setCurrentPage(1);
  };

  // old-style helpers
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const removeTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  const clearAllTags = () => {
    setSelectedTags([]);
  };

  const setSelectedMountId = (id: string) => {
    _setSelectedMountId(id);
    _setCurrentPage(1);
  };

  const clearMount = () => {
    _setSelectedMountId('');
    _setCurrentPage(1);
  };

  const setSortOrder = (s: SortOption) => {
    _setSortOrder(s);
    _setCurrentPage(1);
  };

  const setPageSize = (n: number) => {
    _setPageSize(n);
    _setCurrentPage(1);
  };

  const setDurationFilter = (l: LenOption) => {
    _setDurationFilter(l);
    _setCurrentPage(1);
  };

  const resetAll = () => {
    _setSearchText('');
    _setSelectedTags([]);
    _setSelectedMountId('');
    _setDurationFilter('any');
    _setSortOrder('newest');
    _setPageSize(20);
    _setCurrentPage(1);
  };

  return {
    searchText,
    selectedTags,
    selectedMountId,
    currentPage,
    sortOrder,
    pageSize,
    durationFilter,
    minDurationSec,
    maxDurationSec,

    setCurrentPage,
    setSearchText,
    setSelectedTags,

    toggleTag,
    removeTag,
    clearAllTags,

    setSelectedMountId,
    clearMount,

    setSortOrder,
    setPageSize,
    setDurationFilter,

    resetAll,
  };
}
