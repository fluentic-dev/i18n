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
