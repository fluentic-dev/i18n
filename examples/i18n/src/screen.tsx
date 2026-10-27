import { t } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';
import { type ReactNode, useState } from 'react';
import { loadExampleCatalog } from './catalogs';

I18nManager.configure({ languageId: 'en', fallbackLanguageId: 'en' });
I18nManager.setTranslationLoader(loadExampleCatalog);
export const ready = I18nManager.init();

const strong = (chunks: unknown[]) => <strong>{chunks as string[]}</strong>;

export function I18nDemo() {
  const [languageId, setLanguageId] = useState<'en' | 'fr' | 'fr-CA'>('en');
  const [screen, setScreen] = useState<'overview' | 'cases'>('overview');
  const [members, setMembers] = useState(7);
  const [status, setStatus] = useState('on_track');
  const [updatedAt] = useState(() => new Date('2026-10-25T09:30:00Z'));
  const changeLanguage = (next: 'en' | 'fr' | 'fr-CA') => {
    setLanguageId(next);
    void I18nManager.setLanguageId(next);
  };

  return (
    <main className='shell'>
      <aside className='sidebar'>
        <div className='brand'>
          <span className='mark'>F</span>
          <span>Fluentic</span>
        </div>
        <nav>
          <button className={screen === 'overview' ? 'active' : ''} onClick={() => setScreen('overview')}>
            <span>▦</span>
            {t.text('Overview')}
          </button>
          <button className={screen === 'cases' ? 'active' : ''} onClick={() => setScreen('cases')}>
            <span>◌</span>
            {t.text('Case lab')}
          </button>
        </nav>
        <div className='sidebar-foot'>
          <span className='avatar'>AK</span>
          <span>Alex Kim</span>
          <span className='dot'>●</span>
        </div>
      </aside>
      <section className='content'>
        <header className='header'>
          <div>
            <p className='eyebrow'>{t.text('Fluentic casebook')}</p>
            <h1>{t.text('A practical i18n test bench')}</h1>
            <p className='lede'>
              {t.text(
                'Use the overview as a realistic product screen, then open the case lab to exercise one behavior at a time.',
              )}
            </p>
          </div>
          <div className='actions'>
            <label className='language'>
              <span>{t.text('Language')}</span>
              <select
                value={languageId}
                onChange={(event) => changeLanguage(event.target.value as typeof languageId)}
                aria-label='Language'
              >
                <option value='en'>English</option>
                <option value='fr'>Français</option>
                <option value='fr-CA'>Français (Canada)</option>
              </select>
            </label>
            <button className='primary'>{t.text('Invite teammate')}</button>
          </div>
        </header>
        {screen === 'overview'
          ? <Overview members={members} setMembers={setMembers} updatedAt={updatedAt} />
          : (
            <CaseLab
              members={members}
              setMembers={setMembers}
              status={status}
              setStatus={setStatus}
              updatedAt={updatedAt}
            />
          )}
        <footer>
          {t.text('Built to test the edges of a small, composable i18n API.')}{' '}
          <code>case → catalog → runtime → assertion</code>
        </footer>
      </section>
    </main>
  );
}

type SharedProps = {
  members: number;
  setMembers: (value: number) => void;
  updatedAt: Date;
};

function Overview({ members, setMembers, updatedAt }: SharedProps) {
  return (
    <div className='grid'>
      <article className='card summary'>
        <div className='card-head'>
          <span className='icon purple'>◈</span>
          <div>
            <h2>{t.text('Workspace summary')}</h2>
            <p>{t.text('Updated {date, date, short}', { date: updatedAt })}</p>
          </div>
        </div>
        <div className='metric'>
          <strong>{members}</strong>
          <span>{t.text('{count, plural, =0 {No members} one {# member} other {# members}}', { count: members })}</span>
        </div>
        <div className='meter'>
          <span style={{ width: '68%' }} />
        </div>
        <div className='small-row'>
          <span>{t.text('Monthly active users')}</span>
          <b>{t.text('{count, number}', { count: 12480 })}</b>
        </div>
      </article>
      <article className='card project'>
        <div className='card-head'>
          <span className='icon orange'>↗</span>
          <div>
            <h2>{t.text('Localization rollout')}</h2>
            <p className='status'>
              {t.text('{status, select, on_track {On track} at_risk {At risk} done {Complete} other {Unknown}}', {
                status: 'on_track',
              })}
            </p>
          </div>
          <button className='more' aria-label='More actions'>•••</button>
        </div>
        <div className='progress'>
          <div>
            <b>{t.text('{completed, number} of {total, number} tasks complete', { completed: 18, total: 24 })}</b>
            <b>75%</b>
          </div>
          <div className='meter'>
            <span style={{ width: '75%' }} />
          </div>
        </div>
        <p className='note'>
          {t.jsx('Next milestone: <strong>review translated strings</strong> with the regional teams.', {
            strong: t.tag(strong),
          }) as ReactNode}
        </p>
      </article>
      <article className='card activity'>
        <div className='card-head'>
          <span className='icon blue'>≋</span>
          <div>
            <h2>{t.text('Recent activity')}</h2>
            <p>{t.text('Updated {date, date, short}', { date: updatedAt })}</p>
          </div>
        </div>
        <div className='activity-item'>
          <span className='avatar pink'>MC</span>
          <p>
            {t.text('{name} changed the {field} in {project}.', {
              name: 'Maya Chen',
              field: 'locale fallback',
              project: 'Workspace',
            })}
            <small>12 minutes ago</small>
          </p>
        </div>
        <div className='activity-item'>
          <span className='avatar green'>JR</span>
          <p>
            {t.text('{name} changed the {field} in {project}.', {
              name: 'Jon Rivera',
              field: 'review status',
              project: 'Localization rollout',
            })}
            <small>48 minutes ago</small>
          </p>
        </div>
        <button className='text-button'>
          {t.text('{count, plural, one {# more event} other {# more events}}', { count: 3 })} →
        </button>
      </article>
      <article className='card preferences'>
        <div className='card-head'>
          <span className='icon green'>✓</span>
          <div>
            <h2>{t.text('Test controls')}</h2>
            <p>{t.text('Change values to exercise formatting')}</p>
          </div>
        </div>
        <label>
          {t.text('Team members')}
          <input
            type='range'
            min='0'
            max='20'
            value={members}
            onChange={(event) => setMembers(Number(event.target.value))}
          />
        </label>
        <div className='control-row'>
          <span>{t.text('{count, plural, =0 {No members} one {# member} other {# members}}', { count: members })}</span>
          <button className='secondary'>{t.text('Save preferences')}</button>
        </div>
      </article>
    </div>
  );
}

function CaseLab(
  { members, setMembers, status, setStatus, updatedAt }: SharedProps & {
    status: string;
    setStatus: (value: string) => void;
  },
) {
  return (
    <section className='casebook'>
      <p className='case-intro'>{t.text('Each card is a reproducible behavior covered by the example test suite.')}</p>
      <div className='grid case-grid'>
        <Case title={t.text('Plural branches')} detail={t.text('Try zero, one, and many.')}>
          <div className='segmented'>
            {[0, 1, 2, 12].map((count) => (
              <button
                className={members === count ? 'selected' : ''}
                onClick={() => setMembers(count)}
                key={count}
              >
                {count}
              </button>
            ))}
          </div>
          <output>
            {t.text('{count, plural, =0 {No members} one {# member} other {# members}}', { count: members })}
          </output>
        </Case>
        <Case title={t.text('Select branches')} detail={t.text('Every product state has copy.')}>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value='on_track'>on-track</option>
            <option value='at_risk'>at-risk</option>
            <option value='done'>done</option>
            <option value='other'>other</option>
          </select>
          <output>
            {t.text('{status, select, on_track {On track} at_risk {At risk} done {Complete} other {Unknown}}', {
              status,
            })}
          </output>
        </Case>
        <Case title={t.text('Numbers and dates')} detail={t.text('Locale-aware output from real values.')}>
          <output>{t.text('Invoice total: {amount, number, ::currency/EUR}', { amount: 1234.5 })}</output>
          <output>{t.text('Due {date, date, long}', { date: updatedAt })}</output>
        </Case>
        <Case title={t.text('Rich text')} detail={t.text('Translators can move tagged content.')}>
          <output>
            {t.jsx('Read the <link>integration guide</link> before shipping.', {
              link: t.tag((chunks) => <a href='#guide'>{chunks as string[]}</a>),
            }) as ReactNode}
          </output>
        </Case>
        <Case title={t.text('Context')} detail={t.text('The same source can mean different things.')}>
          <dl>
            <div>
              <dt>{t.text('Menu action')}</dt>
              <dd>{t.context('navigation').text('Open')}</dd>
            </div>
            <div>
              <dt>{t.text('Ticket state')}</dt>
              <dd>{t.context('ticket.status').text('Open')}</dd>
            </div>
          </dl>
        </Case>
        <Case
          title={t.text('Regional fallback')}
          detail={t.text('fr-CA loads the fr catalog before falling back to source copy.')}
        >
          <output>{t.text('This sentence exists in French.')}</output>
          <span className='hint'>fr-CA → fr → en</span>
        </Case>
        <Case title={t.text('Source fallback')} detail={t.text('Missing translations remain readable.')}>
          <output>{t.text('This message is intentionally missing from every translated catalog.')}</output>
          <span className='hint'>translation: missing · source: available</span>
        </Case>
      </div>
    </section>
  );
}

function Case({ title, detail, children }: { title: string; detail: string; children: ReactNode; }) {
  return (
    <article className='card test-case'>
      <div className='card-head'>
        <span className='icon purple'>✓</span>
        <div>
          <h2>{title}</h2>
          <p>{detail}</p>
        </div>
      </div>
      <div className='case-result'>{children}</div>
    </article>
  );
}
