import { invoke } from '@tauri-apps/api/core';

export function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function invokeTauri<T>(command: string, args?: Record<string, unknown>) {
  if (!isTauriRuntime()) {
    throw new Error('この操作は Tauri 版でのみ利用できます。');
  }
  return invoke<T>(command, args);
}
