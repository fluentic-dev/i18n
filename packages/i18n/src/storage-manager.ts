import type { LanguageId } from './core/types';

export type StoredState = { languageId: LanguageId; };
export type I18nStorage = {
  read(): StoredState | null | Promise<StoredState | null>;
  write(state: StoredState): void | Promise<void>;
};

export function createStorageManager(initial: I18nStorage | null = null) {
  let storage = initial;

  return {
    setStorage(next: I18nStorage | null): void {
      storage = next;
    },
    getStorage(): I18nStorage {
      if (!storage) throw new Error('[i18n] storage is not configured');
      return storage;
    },
    hasStorage(): boolean {
      return storage !== null;
    },
  };
}

export function createLocalStorage(): I18nStorage | null {
  if (typeof globalThis.localStorage === 'undefined') return null;
  return {
    read() {
      const value = globalThis.localStorage.getItem('fluentic:i18n:state');
      if (!value) return null;
      try {
        return JSON.parse(value) as StoredState;
      } catch {
        return null;
      }
    },
    write(state) {
      globalThis.localStorage.setItem('fluentic:i18n:state', JSON.stringify(state));
    },
  };
}
