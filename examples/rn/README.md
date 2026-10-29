# React Native / Expo adapter

The CLI generates `i18n/translations/fr/merged.json` from the checked-in authoring files. Run `pnpm --filter @example/rn exec fluentic-i18n update` after changing messages or translations. `pnpm --filter @example/rn build` exercises the RN Babel plugin against TSX and writes code + a source map. Run `pnpm --filter @example/rn dev` to start Expo, then open the app in Expo Go or an installed simulator. `ios` and `android` launch the respective targets. The app pins the Expo 55 / React 19.2 / React Native 0.83 compatibility set.

Persistence is opt-in: pass your AsyncStorage instance to `createNativeStorage` and then `I18nManager.setStorage`.
