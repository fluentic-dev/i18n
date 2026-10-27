# @fluentic/i18n-rn

React Native adapter. Messages import universal `t`; setup imports the manager/state here. Render textual JSX inside native `Text`. `createNativeStorage` accepts an AsyncStorage-compatible store without forcing a native dependency.

Use `@fluentic/i18n-rn/plugin/babel` with `compiled: true`, keeping the host Expo/Metro preset. See `examples/rn` for a runnable Expo app and Babel build smoke test.
