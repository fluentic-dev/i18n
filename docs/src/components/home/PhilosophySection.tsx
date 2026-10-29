import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from '../../pages/index.module.css';
import HomeIcon from '../HomeIcon';
import { CodeBlock } from './shared';

const principles = [
  [
    'context',
    '01 · KEEP WRITING STRINGS',
    'Mark messages where they are defined.',
    'Write source text where it belongs. Use t.msg() for shared messages, or pass text directly to t.jsx() and t.text().',
    "t.jsx('Hello, {name}!', { name: 'Ada' });",
  ],
  [
    'rich',
    '02 · ONE MESSAGE FORMAT',
    'Use ICU for expressive messages.',
    'Params, plurals, selects, and tags stay inside the message. Use ICU syntax without separate plural helpers or JSX wrappers.',
    "t.text('{count, plural, one {# file} other {# files}}', { count: 3 });",
  ],
  [
    'code',
    '03 · START BEFORE YOU NEED IT',
    'Mark messages now. Translate them later.',
    'Render source text before setting up another language or translation service. The messages are already marked when translation work begins.',
    'pnpm add @fluentic/i18n',
  ],
  [
    'message',
    '04 · DEFINE BEFORE YOU RENDER',
    'Keep messages independent of their output.',
    'Messages often need to be declared in constants, business logic, or shared packages before a component knows how they will appear. A MessageDescriptor carries the source text and param types until it is rendered.',
    "const saved = t.msg('Changes saved');\nt.jsx(saved);\nt.text(saved);",
  ],
  [
    'translate',
    '05 · INCLUDE THE TRANSLATION WORK',
    'Integrate translation into the workflow.',
    'The CLI recognizes translatable markers, extracts messages, and supports automatic services, manual translations, and import/export converters.',
    'pnpm i18n update',
  ],
  [
    'download',
    '06 · FINISH THE JOB AT RUNTIME',
    'Load and switch catalogs at runtime.',
    'Register a loader for catalog text, switch languages through I18nManager, and let t.jsx() or I18nState.use() keep output current.',
    "await I18nManager.setLanguageId('fr');",
  ],
];

export function PhilosophySection() {
  return (
    <section className={`${styles.section} ${styles.philosophy}`} aria-labelledby='why-fluentic'>
      <div className={styles.philosophyIntro}>
        <p className={styles.eyebrow}>Why Fluentic was built</p>
        <Heading as='h2' id='why-fluentic'>
          Writing a message is simple.<br />
          <span>Making it translatable should be, too.</span>
        </Heading>
        <p>
          Fluentic came from working on large apps where messages lived in components, business logic, and shared
          packages. The recurring problem was how much extra code and setup a translatable string could need.
        </p>
      </div>
      <div className={styles.philosophyBody}>
        {principles.map(([icon, step, title, text, code]) => (
          <article key={step}>
            <div className={styles.storyStep}>
              <HomeIcon name={icon} />
              <span>{step}</span>
            </div>
            <Heading as='h3'>{title}</Heading>
            <p>{text}</p>
            <CodeBlock language={code.startsWith('pnpm') ? 'bash' : 'tsx'}>{code}</CodeBlock>
          </article>
        ))}
      </div>
      <div className={styles.philosophySolution}>
        <div>
          <Heading as='h3'>Learn the message API once.</Heading>
          <p>
            Use the same message API in React web apps, React Native, and Next.js. Platform adapters handle rendering,
            state, and request setup; shared business modules keep importing t from @fluentic/i18n.
          </p>
        </div>
        <Link to='/docs/intro'>
          Write your first message <span aria-hidden='true'>→</span>
        </Link>
      </div>
    </section>
  );
}
