// FILE: src/hooks/useAppSettings.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/client';
import type { AppSettings } from '../types/domain';

const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  schemaVersion: 1,
  pinnedTags: [],
  tagSort: 'popular',
  filterMode: 'AND',
  thumbStore: 'idb',
};

export function useAppSettings(): AppSettings {
  const settings = useLiveQuery(async () => {
    return await db.settings.get('app');
  }, []);

  return settings || DEFAULT_SETTINGS;
}
