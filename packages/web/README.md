# @fluentic/i18n-web

React web adapter for universal `t` from `@fluentic/i18n`. Exports `I18nManager`, `I18nState`, `I18nProvider`, `createI18nManager`, `useI18nRenderer`, optional `createLocalStorage`, and `createTranslationCacheLoader`.

Configure a loader, await `I18nManager.init()`, then mount the app. `t.jsx(message)` subscribes internally. For string props, use `I18nState.use()` to rerender the component or `t.jsx(() => element)` as a fine-grained single-element boundary. Isolated providers can also bind `t.text` with `useI18nRenderer`. Storage is opt-in. The adapter is shared by dynamic and compiled formatting.

```tsx
const field = t.jsx(() => <input placeholder={t.text('Search')} />);
```

Only the wrapper reruns on language changes. The callback must return one React element; keep hooks in components or custom hooks. Nested message calls are extracted and compiled normally.

See `examples/i18n` and `examples/compiled-vite`.

Wrap a remote loader to persist its returned catalog data in localStorage. The generated hash manifest invalidates each language independently:

```ts
const cacheLoader = createTranslationCacheLoader(loader, {
  hash: () => import('./i18n/translations/hash.json'),
  storageMode: 'last', // Optional; defaults to 'all'.
});
I18nManager.setTranslationLoader(cacheLoader.loader);

cacheLoader.remove('fr');
cacheLoader.clear();
```

The hash source may be a manifest object or a synchronous/async function. Dynamic-import module defaults are unwrapped. Languages missing from the manifest bypass persistent caching. `remove(languageId)` evicts one language and `clear()` removes the wrapper's complete persistent cache.

`storageMode: 'all'` keeps all loaded catalogs, preserving the default behavior. `'last'` keeps only the selected language after a successful manager initialization or switch, including switches back to an in-memory catalog. Base-language and fallback loads do not replace the selected locale. Failed or superseded switches leave the previous persisted selection intact. Use the matching updated core and web packages for selection-aware behavior.

When calling the wrapped loader directly, `'last'` keeps the most recently requested successful catalog, including cache hits; slower older requests cannot overwrite newer results. If the selected language has no hash, its data is not persisted and the previous persistent entries are removed after success. Only this wrapper's `storageKey` is affected; other localStorage data and the manager's in-memory catalogs are unchanged. Storage writes remain best effort when browser storage is unavailable or full.
