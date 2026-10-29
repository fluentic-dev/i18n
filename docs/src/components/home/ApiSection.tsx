import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from '../../pages/index.module.css';
import HomeIcon from '../HomeIcon';
import { apis } from './data';
import { CodeBlock, InlineCode } from './shared';

export function ApiSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>The core API</p>
          <Heading as='h2'>
            Write messages where they belong.<br />Keep i18n simple.
          </Heading>
        </div>
        <p>
          Use <code>t.jsx()</code> inside JSX, <code>t.text()</code> when you need a string, and <code>t.msg()</code>
          {' '}
          when the message should be defined now and rendered later.
        </p>
      </div>
      <div className={styles.apiGrid}>
        {apis.map((api) => (
          <article className={styles.apiCard} key={api.name}>
            <div className={styles.apiHeader}>
              <HomeIcon name={api.icon} />
              <div className={styles.apiLabel}>
                <code>{api.name}</code>
                <span>{api.label}</span>
              </div>
            </div>
            <Heading as='h3'>{api.title}</Heading>
            <p>
              <InlineCode text={api.text} />
            </p>
            <CodeBlock language='tsx'>{api.code}</CodeBlock>
            <Link to={api.to}>
              Explore {api.name} <span aria-hidden='true'>↗</span>
            </Link>
          </article>
        ))}
      </div>
      <div className={styles.directMessages}>
        <div>
          <Heading as='h3'>Pass messages directly</Heading>
          <p>
            <code>t.jsx()</code> and <code>t.text()</code> accept a message and optional params directly, like{' '}
            <code>t.msg()</code>, for convenience.
          </p>
          <p>
            For JSX tags, <code>t.tag()</code>{' '}
            keeps the element in your code while translators can move the tagged content within the sentence.
          </p>
        </div>
        <CodeBlock language='tsx'>
          {"// Direct JSX output\nt.jsx('Welcome, {name}!', { name: 'Ada' });\n\n// Direct string output\nt.text('Welcome, {name}!', { name: 'Ada' });\n\n// Direct JSX with a tag\nt.jsx('Read <link>the guide</link>.', {\n  link: t.tag(<a href=\"/docs\" />),\n});"}
        </CodeBlock>
      </div>
    </section>
  );
}
