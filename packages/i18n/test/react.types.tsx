import type { ReactElement } from 'react';
import { defineTranslationLoader, type MessageDescriptor, t, type TranslationItem } from '../src/index';
import { I18nManager, I18nState } from '../src/react';

const french: TranslationItem[] = [{ id: 'Welcome back!', translation: 'Bon retour !' }];
I18nManager.setTranslationLoader(({ languageId }) => languageId === 'fr' ? french : []);

const shared = t.msg('Hello, {name}', { name: String });
const inline: ReactElement = t.jsx('Hello');
const scoped: ReactElement = t.context('welcome').note('Greeting').meta({ screen: 'home' }).jsx(shared, {
  name: 'Ada',
});
const rich: ReactElement = t.jsx('Read <link>the guide</link>', {
  link: t.tag((chunks) => <a href='/guide'>{chunks}</a>),
});
const computed: ReactElement = t.jsx(shared, { name: ({ languageId }) => languageId === 'fr' ? 'Amélie' : 'Ada' });
const text: string = t.try(t.text, shared, { name: 'Ada' });
const content: string | ReactElement = t.try(t.jsx, shared, { name: 'Ada' });
const unchanged: number = t.try(t.text, 42);
function acceptMessage(value: string | MessageDescriptor): string {
  return t.try(t.text, value);
}

export function Example() {
  I18nState.use();
  return (
    <section title={t.text(shared, { name: 'Ada' })}>
      {inline}
      {scoped}
      {rich}
      {computed}
      {text}
      {content}
      {unchanged}
      {acceptMessage(shared)}
    </section>
  );
}

// @ts-expect-error A declared message parameter is required at every render site.
t.text(shared);
// @ts-expect-error t.try preserves the descriptor's required parameter schema.
t.try(t.text, shared);
// @ts-expect-error A declared message parameter must have the inferred type.
t.jsx(shared, { name: 42 });

const elementTag: ReactElement = t.jsx('Hello <strong>{name}</strong>', {
  name: 'Ada',
  strong: t.tag(<strong className='name' />),
});
// @ts-expect-error Element shorthand requires a React element, not a string.
t.tag('strong');

I18nManager.setTranslationLoader(defineTranslationLoader({
  en: [],
  fr: french,
  de: Promise.resolve({ jsonl: '' }),
  ja: () => Promise.resolve({ default: '' }),
  es: '',
}));
defineTranslationLoader(async ({ languageId }) => languageId === 'fr' ? french : []);
// @ts-expect-error Map entries must be catalog data, not arbitrary objects.
defineTranslationLoader({ fr: { hello: 'Bonjour' } });
