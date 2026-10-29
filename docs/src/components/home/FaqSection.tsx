import Heading from '@theme/Heading';
import styles from '../../pages/index.module.css';
import { faqs } from './data';
import { InlineCode } from './shared';

export function FaqSection() {
  return (
    <section className={styles.faq}>
      <p className={styles.eyebrow}>Developer FAQ</p>
      <Heading as='h2'>Frequently asked questions.</Heading>
      <div className={styles.faqList}>
        {faqs.map(([question, answer]) => (
          <details key={question}>
            <summary>
              <span>
                <InlineCode text={question} />
              </span>
              <span aria-hidden='true'>⌄</span>
            </summary>
            {answer.split('\n\n').map((paragraph) => (
              <p key={paragraph}>
                <InlineCode text={paragraph} />
              </p>
            ))}
          </details>
        ))}
      </div>
    </section>
  );
}
