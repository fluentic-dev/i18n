import { useSyncExternalStore } from 'react';
import { defaultI18nState, type StateData } from './manager';

export type { StateData } from './manager';

export const I18nState = {
  get(): StateData {
    return defaultI18nState.get();
  },
  subscribe(listener: () => void): () => void {
    return defaultI18nState.subscribe(listener);
  },
  use(): StateData {
    return useSyncExternalStore(I18nState.subscribe, I18nState.get, I18nState.get);
  },
};

export function updateState(next: Partial<StateData>): void {
  defaultI18nState.set(next);
}
