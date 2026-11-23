import type { ReactElement } from 'react';
import type { AnyMessageDescriptor, MessageSchema } from '../src/index';
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
const reactiveElement: ReactElement = t.jsx(() => <input placeholder={t.text('Something')} />);
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
      {reactiveElement}
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

// @ts-expect-error An incomplete parameter object must still be rejected.
t.jsx(shared, {});
// @ts-expect-error Unknown parameters must still be rejected.
t.text(shared, { name: 'Ada', extra: true });

const nestedLabel = t.msg('Ada');
t.text('Hello {name}', { name: nestedLabel });
t.jsx('Hello {name}', { name: () => nestedLabel });
const descriptorField = t.msg('Hello {name}', { name: t.msg });
t.text(descriptorField, { name: nestedLabel });
t.jsx(descriptorField, { name: nestedLabel });
t.text(descriptorField, { name: () => nestedLabel });
t.jsx(descriptorField, { name: ({ languageId }) => languageId === 'fr' ? t.msg('Amélie') : nestedLabel });
t.try(t.text, descriptorField, { name: nestedLabel });
// @ts-expect-error String fields accept external strings, not descriptors.
t.text(shared, { name: nestedLabel });
// @ts-expect-error String callbacks must return strings.
t.jsx(shared, { name: () => nestedLabel });
// @ts-expect-error Message fields require descriptors, not external strings.
t.text(descriptorField, { name: 'Ada' });
// @ts-expect-error Message callbacks must return descriptors.
t.jsx(descriptorField, { name: () => 'Ada' });
// @ts-expect-error Message fields remain required.
t.jsx(descriptorField, {});
// @ts-expect-error Message fields reject arbitrary objects.
t.jsx(descriptorField, { name: {} });

const boundGreeting = t.msg(descriptorField, { name: nestedLabel });
t.text(boundGreeting);
t.jsx(boundGreeting);
t.try(t.text, boundGreeting);
t.try(t.jsx, boundGreeting);
t.text(t.clone(boundGreeting));
t.jsx(t.msg(boundGreeting, { name: t.msg('Grace') }));
t.jsx(boundGreeting, { name: () => t.msg('Grace') });
t.jsx(t.context('component').msg(descriptorField, { name: nestedLabel }));
t.jsx(t.msg(descriptorField, { name: t.msg(shared, { name: 'Ada' }) }));
const metricItems = [boundGreeting, t.msg('Plain label')];
metricItems.map((label) => t.jsx(label));
// @ts-expect-error Binding requires all declared parameters.
t.msg(shared);
// @ts-expect-error An empty binding does not satisfy required parameters.
t.msg(shared, {});
// @ts-expect-error Binding values must match the declared schema.
t.msg(shared, { name: 42 });
// @ts-expect-error Unknown binding keys are rejected.
t.msg(shared, { name: 'Ada', extra: true });
// @ts-expect-error Bound overrides retain the descriptor field type.
t.jsx(boundGreeting, { name: 'Grace' });
// @ts-expect-error Rebinding retains the descriptor field type.
t.msg(boundGreeting, { name: 'Grace' });
const boundExternal = t.msg(shared, { name: 'Ada' });
t.jsx(t.msg(boundExternal, { name: 'Grace' }));

const erasedBound: AnyMessageDescriptor = boundGreeting;
t.jsx<string, MessageSchema | undefined>(erasedBound, {});
t.text<string, MessageSchema | undefined>(erasedBound, {});

// @ts-expect-error Descriptor text is internal.
shared.text;
// @ts-expect-error Runtime schema is internal.
shared.schema;
// @ts-expect-error Bound params are internal.
boundGreeting.boundParams;
// @ts-expect-error Factory marker is internal.
t.msg.__fluenticMessageFactory;

// @ts-expect-error Nullish params cannot promise required fields.
const absentParams: { name: string; } = t.params<{ name: string; }>(null);
// @ts-expect-error Omitted params cannot promise required fields.
const omittedParams: { name: string; } = t.params<{ name: string; }>();
const presentParams: { name: string; } = t.params({ name: 'Ada' });
declare const optionalParams: { name: string; } | undefined;
// @ts-expect-error Optional input must retain the possibility of an empty result.
const maybeParams: { name: string; } = t.params(optionalParams);
t.params();
t.params(null);
t.params(undefined);
// @ts-expect-error Callback JSX accepts no parameter object.
t.jsx(() => <span />, {});

// @ts-expect-error Nested descriptors must bind their required params before rendering.
t.jsx(descriptorField, { name: shared });
// @ts-expect-error Descriptor factories must also return a ready-to-render descriptor.
t.msg(descriptorField, { name: () => shared });
t.jsx(descriptorField, { name: t.msg('No params', {}) });
