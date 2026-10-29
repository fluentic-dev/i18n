import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-rn';
import React, { useEffect, useState } from 'react';
import { Button, Text, View } from 'react-native';
import french from './i18n/translations/fr/merged.json';

const c = t.context('account');
const greeting = c.msg('Hello {name}{break}Welcome back', { name: String });

I18nManager.configure({ languageId: 'fr' });
I18nManager.setTranslationLoader(({ languageId }) => languageId === 'fr' ? french : []);
const ready = I18nManager.init();

function Screen() {
  const state = I18nState.use();
  const [error, setError] = useState(false);

  const switchLanguage = async () => {
    try {
      setError(false);
      await I18nManager.setLanguageId(state.languageId === 'fr' ? 'en' : 'fr');
    } catch {
      setError(true);
    }
  };

  return (
    <View style={{ padding: 24, paddingTop: 80 }}>
      <Text>{t.jsx(greeting, { name: 'Ada' })}</Text>
      <Button title='Switch language' disabled={state.isLoading} onPress={switchLanguage} />
      {error && <Text>Unable to switch language.</Text>}
    </View>
  );
}

export default function App() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;

    ready.then(
      () => {
        if (active) setStatus('ready');
      },
      () => {
        if (active) setStatus('error');
      },
    );

    return () => {
      active = false;
    };
  }, []);

  if (status !== 'ready') return <Text>{status === 'error' ? 'Unable to load translations.' : 'Loading…'}</Text>;

  return <Screen />;
}
