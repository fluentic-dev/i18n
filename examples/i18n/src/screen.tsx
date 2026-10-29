import { t } from '@fluentic/i18n';
import { I18nManager, I18nState } from '@fluentic/i18n-web';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { loadExampleTranslations } from './translations';

I18nManager.configure({ languageId: 'en', fallbackLanguageId: 'en' });
I18nManager.setTranslationLoader(loadExampleTranslations);
export const ready = I18nManager.init();

export function I18nDemo() {
  I18nState.use();
  const [screen, setScreen] = useState<'overview' | 'cases'>('overview');
  const [members, setMembers] = useState(7);
  const [status, setStatus] = useState('on_track');
  const [updatedAt] = useState(() => new Date('2026-10-25T09:30:00Z'));

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
            <LanguageSelect />
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

const languageOptions = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'fr-CA', label: 'Français (Canada)' },
];

function LanguageSelect() {
  const { isLoading, languageId } = I18nState.use();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selected = languageOptions.find((option) => option.id === languageId) ?? languageOptions[0];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  return (
    <div className='language' ref={root}>
      <span>{t.text('Language')}</span>
      <button
        type='button'
        className='language-trigger'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={t.text('Language')}
        aria-busy={isLoading}
        disabled={isLoading}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selected.label}</span>
        {isLoading ? <span className='spinner' aria-label={t.text('Loading translations')} /> : <span>⌄</span>}
      </button>
      {open && (
        <div className='language-menu' role='listbox' aria-label={t.text('Language')}>
          {languageOptions.map((option) => (
            <button
              type='button'
              role='option'
              aria-selected={option.id === languageId}
              className={option.id === languageId ? 'selected' : ''}
              key={option.id}
              onClick={async () => {
                setOpen(false);
                if (option.id !== languageId) await I18nManager.setLanguageId(option.id);
              }}
            >
              <span>{option.label}</span>
              {option.id === languageId && <span aria-hidden='true'>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
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
            strong: t.tag((chunks) => <strong>{chunks}</strong>),
          })}
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
          <CaseSelect value={status} onChange={setStatus} />
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
              link: t.tag((chunks) => <a href='#guide'>{chunks}</a>),
            })}
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

const statusOptions = ['on_track', 'at_risk', 'done', 'other'];

function CaseSelect({ value, onChange }: { value: string; onChange: (value: string) => void; }) {
  const [open, setOpen] = useState(false);
  return (
    <div className='case-select'>
      <button
        type='button'
        className='case-select-trigger'
        aria-haspopup='listbox'
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{value.replace('_', '-')}</span>
        <span aria-hidden='true'>⌄</span>
      </button>
      {open && (
        <div className='case-select-menu' role='listbox'>
          {statusOptions.map((option) => (
            <button
              type='button'
              role='option'
              aria-selected={option === value}
              className={option === value ? 'selected' : ''}
              key={option}
              onClick={() => {
                setOpen(false);
                onChange(option);
              }}
            >
              {option.replace('_', '-')}
            </button>
          ))}
        </div>
      )}
    </div>
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
