import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from '../../pages/index.redesign.module.css';
import HomeIcon from '../HomeIcon';
import { steps } from './data';
import { InlineCode } from './shared';

export function WorkflowSection() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>A connected translation workflow</p>
          <Heading as='h2'>From source code to shipped languages.</Heading>
        </div>
        <p>
          Run the workflow from package scripts or CI. Use automatic translation, manual translations, or both. The CLI
          builds catalogs ready for your app.
        </p>
      </div>
      <div className={styles.steps}>
        {steps.map((step, index) => (
          <Link className={styles.step} key={step.title} to={step.to}>
            <span className={styles.stepNumber}>STEP 0{index + 1}</span>
            <HomeIcon name={['code', 'extract', 'translate', 'review', 'download'][index]} />
            <Heading as='h3'>{step.title}</Heading>
            <p>
              <InlineCode text={step.text} />
            </p>
            <span className={styles.stepDetail}>
              <InlineCode text={step.detail} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
