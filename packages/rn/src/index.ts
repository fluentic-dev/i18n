export * from '@fluentic/i18n/react';
import type { I18nStorage } from '@fluentic/i18n/adapter';
/** Supply AsyncStorage (or a compatible store); no native dependency is forced. */
export function createNativeStorage(
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; },
  key = 'fluentic:i18n:state',
): I18nStorage {
  return {
    async read() {
      const value = await storage.getItem(key);
      if (!value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
    async write(state) {
      await storage.setItem(key, JSON.stringify(state));
    },
  };
}
