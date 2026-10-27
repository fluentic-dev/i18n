import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from '../../pages/index.redesign.module.css';
import { icuExamples } from './data';
import icuStyles from './icu.module.css';
import { CodeBlock } from './shared';

export function IcuSection() {
  return (
    <section className={`${styles.section} ${styles.icuSection}`}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>ICU message reference</p>
          <Heading as='h2'>ICU syntax at a glance.</Heading>
        </div>
        <p>
          See the variables, locale-aware formats, grammatical choices, and tags Fluentic supports inside translatable
          messages.
        </p>
      </div>
      <div className={icuStyles.intro}>
        <p>Open a syntax pattern to see the message, runtime values, and Fluentic API together.</p>
        <Link to='/docs/learn/icu'>Read the complete ICU guide ↗</Link>
      </div>
      <div className={icuStyles.list}>
        {icuExamples.map((item, index) => (
          <details className={icuStyles.card} name='icu-example' open={index === 0 ? true : undefined} key={item.title}>
            <summary>
              <span>
                <strong>{item.title}</strong>
                <small>{item.summary}</small>
              </span>
              <span className={icuStyles.toggle} aria-hidden='true'>+</span>
            </summary>
            <div className={icuStyles.body}>
              <p>{item.description}</p>
              <CodeBlock language={item.language}>{item.code}</CodeBlock>
              {item.note && <p className={icuStyles.note}>{item.note}</p>}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
