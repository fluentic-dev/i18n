import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import { ApiSection } from '../components/home/ApiSection';
import { CompilerSection } from '../components/home/CompilerSection';
import { FaqSection } from '../components/home/FaqSection';
import { FeatureSection } from '../components/home/FeatureSection';
import { HeroSection } from '../components/home/HeroSection';
import { IcuSection } from '../components/home/IcuSection';
import { PhilosophySection } from '../components/home/PhilosophySection';
import { WorkbenchSection } from '../components/home/WorkbenchSection';
import { WorkflowSection } from '../components/home/WorkflowSection';
import styles from './index.module.css';

export default function Home() {
  return (
    <Layout
      wrapperClassName='fluentic-home'
      title='I18n made simple'
      description='Internationalization for React and JSX. Define natural messages, render JSX or strings, and manage automatic and reviewed translations in one workflow.'
    >
      <main className={styles.landing}>
        <div className={styles.container}>
          <HeroSection />
          <ApiSection />
          <CompilerSection />
          <FeatureSection />
          <PhilosophySection />
          <WorkbenchSection />
          <IcuSection />
          <WorkflowSection />
          <FaqSection />
          <section className={styles.closing}>
            <div>
              <p className={styles.eyebrow}>Make your next message multilingual</p>
              <h2>
                Start with one message.<br />Build from there.
              </h2>
              <p>
                Install the runtime, write your first message, and follow the guide to a working translation workflow.
              </p>
            </div>
            <div className={styles.actions}>
              <Link className={styles.primary} to='/docs/intro'>
                Get started <span aria-hidden='true'>→</span>
              </Link>
              <Link className={styles.secondary} to='/docs/cli/overview'>Read the CLI guide</Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
