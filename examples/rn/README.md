# React Native / Expo adapter

`pnpm --filter @example/rn build` exercises the actual RN Babel plugin against TSX and writes code + a source map. Run `pnpm --filter @example/rn dev` to start Expo, then open the app in Expo Go or an installed simulator. `ios` and `android` launch the respective targets. The app pins the Expo 55 / React 19.2 / React Native 0.83 compatibility set.

Persistence is opt-in: pass your AsyncStorage instance to `createNativeStorage` and then `I18nManager.setStorage`.
