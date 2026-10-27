import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from '../../pages/index.redesign.module.css';
import HomeIcon from '../HomeIcon';
import { features } from './data';
import { CodeBlock, InlineCode } from './shared';

export function FeatureSection() {
  const groups = [{ id: 'code', title: 'In your code', description: 'Define, render, and load messages.' }, {
    id: 'workflow',
    title: 'Translation workflow',
    description: 'Translate, review, and exchange catalogs.',
  }];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Built for everyday development</p>
          <Heading as='h2'>Less boilerplate for your i18n workflow</Heading>
          <p className={styles.sectionIntro}>
            From the first message to a reviewed catalog, keep translation work close to the way your team already ships
            software.
          </p>
        </div>
      </div>
      {groups.map((group) => (
        <div className={styles.featureGroup} key={group.id}>
          <div className={styles.featureGroupHeading}>
            <Heading as='h3'>{group.title}</Heading>
            <p>{group.description}</p>
          </div>
          <div className={styles.featureGrid}>
            {features.filter((feature) => feature.group === group.id).map((feature) => (
              <article className={styles.feature} key={feature.title}>
                <HomeIcon name={feature.icon} />
                <Heading as='h4'>
                  <Link to={feature.to}>
                    {feature.title}
                    <span className={styles.cardArrow} aria-hidden='true'>↗</span>
                  </Link>
                </Heading>
                <p>
                  <InlineCode text={feature.text} />
                </p>
                <div className={styles.featureExamples}>
                  <CodeBlock language={feature.language}>{feature.code}</CodeBlock>
                  {feature.command && <CodeBlock language='bash'>{feature.command}</CodeBlock>}
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
