import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-web';
import { collectMessages } from '@fluentic/i18n/compiler';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { catalogs, loadExampleCatalog } from '../src/catalogs.ts';

const plural = '{count, plural, =0 {No members} one {# member} other {# members}}';
const projectStatus = '{status, select, on_track {On track} at_risk {At risk} done {Complete} other {Unknown}}';

async function start(languageId) {
  I18nManager.setStorage(null);
  I18nManager.configure({ languageId, fallbackLanguageId: 'en' });
  I18nManager.setTranslationLoader(loadExampleCatalog);
  await I18nManager.init();
}

test('the casebook source remains statically extractable by the CLI', async () => {
  const source = await readFile(new URL('../src/screen.tsx', import.meta.url), 'utf8');
  const messages = collectMessages(source, 'screen.tsx');
  assert.ok(messages.length >= 35, `expected a complete screen, found ${messages.length} messages`);
  assert.ok(messages.some(({ source, context }) => source === 'Open' && context === 'navigation'));
  assert.ok(messages.some(({ source, context }) => source === 'Open' && context === 'ticket.status'));
  assert.ok(messages.some(({ source }) => source.includes('plural')));
  assert.ok(messages.some(({ source }) => source.includes('<link>')));
});

test('the teachable catalog has unique, non-empty French records', () => {
  const ids = catalogs.fr.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(catalogs.fr.length >= 40, 'the example should remain broad enough to exercise a real screen');
  assert.ok(catalogs.fr.every(({ id, translation }) => id.length > 0 && translation.length > 0));
});

test('plural and select cases cover every branch in source and translated locales', async () => {
  await start('en');
  assert.deepEqual([0, 1, 12].map((count) => t.text(plural, { count })), ['No members', '1 member', '12 members']);
  assert.deepEqual(['on_track', 'at_risk', 'done', 'other'].map((status) => t.text(projectStatus, { status })), [
    'On track',
    'At risk',
    'Complete',
    'Unknown',
  ]);

  await I18nManager.setLanguageId('fr');
  assert.deepEqual([0, 1, 12].map((count) => t.text(plural, { count })), ['Aucun membre', '1 membre', '12 membres']);
  assert.deepEqual(['on_track', 'at_risk', 'done', 'other'].map((status) => t.text(projectStatus, { status })), [
    'Dans les temps',
    'À risque',
    'Terminé',
    'Inconnu',
  ]);
});

test('context disambiguates identical source copy', async () => {
  await start('fr');
  assert.equal(t.context('navigation').text('Open'), 'Ouvrir');
  assert.equal(t.context('ticket.status').text('Open'), 'En cours');
  assert.equal(t.text('Open'), 'Open');
});

test('regional and missing-message fallbacks stay readable', async () => {
  await start('fr-CA');
  assert.equal(I18nState.get().languageId, 'fr-CA');
  assert.equal(t.text('This sentence exists in French.'), 'Cette phrase existe en français.');
  assert.equal(
    t.text('This message is intentionally missing from every translated catalog.'),
    'This message is intentionally missing from every translated catalog.',
  );
});

test('number, date, interpolation, and rich-tag values use the selected locale', async () => {
  await start('fr');
  assert.match(t.text('Invoice total: {amount, number, ::currency/EUR}', { amount: 1234.5 }), /1[\s\u202f]234,50\s€/);
  assert.match(t.text('Due {date, date, long}', { date: new Date('2026-10-25T09:30:00Z') }), /25 octobre 2026/);
  assert.equal(
    t.text('{name} changed the {field} in {project}.', { name: 'Maya', field: 'langue', project: 'Atlas' }),
    'Maya a modifié langue dans Atlas.',
  );
  assert.equal(
    t.text('Read the <link>integration guide</link> before shipping.', {
      link: t.tag((parts) => `[${parts.join('')}]`),
    }),
    'Avant de publier, consultez le [guide d’intégration].',
  );
});
