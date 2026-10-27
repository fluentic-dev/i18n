export type StateManager<StateData> = {
  get(): StateData;
  subscribe(listener: () => void): () => void;
  set(partial: Partial<StateData>): void;
};

export function createStateManager<StateData extends object>(initial: StateData): StateManager<StateData> {
  let current = initial;
  const listeners = new Set<() => void>();

  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(partial) {
      const next = { ...current, ...partial };
      const changed = Object.keys(next).some((key) => current[key as keyof StateData] !== next[key as keyof StateData]);
      if (!changed) return;
      current = next;
      for (const listener of listeners) listener();
    },
  };
}
