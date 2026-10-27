import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-rn';
import React, { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import french from './catalog.mjs';
const c = t.context('account');
const greeting = c.msg('Hello {name}', { name: String });
I18nManager.configure({ languageId: 'fr' });
I18nManager.setTranslationLoader(({ languageId }) => languageId === 'fr' ? french : []);
const ready = I18nManager.init();
function Screen() {
  const state = I18nState.use();
  return (
    <View>
      <Text>{t.jsx(greeting, { name: 'Ada' })}</Text>
      <Button
        title='Switch language'
        onPress={() => I18nManager.setLanguageId(state.languageId === 'fr' ? 'en' : 'fr')}
      />
    </View>
  );
}
export default function App() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    ready.then(() => setLoaded(true));
  }, []);
  return loaded ? <Screen /> : null;
}
