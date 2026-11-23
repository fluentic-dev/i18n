import React from 'react';
import '../src/react';
import { t } from '../src/compiled';
const descriptor = t.msg(['id', ['Hello ', [0, 'name']]], { name: String });
const text: string = t.text(descriptor, { name: 'Ada' });
t.try(t.text, descriptor, { name: 'Ada' });
t.jsx(() => React.createElement('input', { placeholder: t.text(descriptor, { name: 'Ada' }) }));
// @ts-expect-error Reactive JSX callbacks must return one React element.
t.jsx(() => 'reactive content');
// @ts-expect-error Compiled entry does not accept raw ICU strings.
t.text('Hello {name}', { name: 'Ada' });
// @ts-expect-error Required schema is retained.
t.text(descriptor);
// @ts-expect-error Incorrect parameter type.
t.text(descriptor, { name: 42 });

const descriptorField = t.msg(['nested', ['Hello ', [0, 'name']]], { name: t.msg });
const nestedLabel = t.msg(['label', 'Ada']);
t.text(['direct', ['Hello ', [0, 'name']]], { name: nestedLabel });
t.jsx(['direct', ['Hello ', [0, 'name']]], { name: () => nestedLabel });
t.text(descriptorField, { name: nestedLabel });
t.jsx(descriptorField, { name: nestedLabel });
t.text(descriptorField, { name: () => nestedLabel });
t.jsx(descriptorField, { name: () => nestedLabel });

const bound = t.msg(descriptorField, { name: nestedLabel });
t.text(bound);
t.jsx(bound);
t.try(t.text, bound);
t.text(t.clone(bound));
t.jsx(t.msg(bound, { name: nestedLabel }));
// @ts-expect-error Compiled binding requires declared parameters.
t.msg(descriptor, {});
// @ts-expect-error Compiled binding retains parameter types.
t.msg(descriptor, { name: 42 });
// @ts-expect-error Compiled bound overrides retain parameter types.
t.text(bound, { name: 42 });

// @ts-expect-error Compiled String fields reject descriptors.
t.text(descriptor, { name: nestedLabel });
// @ts-expect-error Compiled message fields reject strings.
t.text(descriptorField, { name: 'Ada' });
// @ts-expect-error Compiled binding message fields reject strings.
t.msg(descriptorField, { name: 'Ada' });

const presentParams: { name: string; } = t.params({ name: 'Ada' });
// @ts-expect-error Nullish params cannot promise required fields.
const absentParams: { name: string; } = t.params<{ name: string; }>(null);
// @ts-expect-error Omitted params cannot promise required fields.
const omittedParams: { name: string; } = t.params<{ name: string; }>();
declare const optionalParams: { name: string; } | undefined;
// @ts-expect-error Optional input must retain the possibility of an empty result.
const maybeParams: { name: string; } = t.params(optionalParams);
// @ts-expect-error Callback JSX accepts no parameter object.
t.jsx(() => React.createElement('span'), {});

// @ts-expect-error Nested compiled descriptors must bind their own required params.
t.jsx(descriptorField, { name: descriptor });
// @ts-expect-error Factories must return a descriptor with its required params bound.
t.msg(descriptorField, { name: () => descriptor });
t.jsx(descriptorField, { name: t.msg(descriptor, { name: 'Ada' }) });
