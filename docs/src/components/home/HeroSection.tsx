import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import { useState } from 'react';
import styles from '../../pages/index.module.css';
import { heroExamples, locales } from './data';
import { CodeBlock, InstallCommand } from './shared';

export function HeroSection() {
  const [heroExample, setHeroExample] = useState(0);
  const [locale, setLocale] = useState(0);
  const [inPractice, setInPractice] = useState(false);
  const active = heroExamples[heroExample];
  const language = locales[locale];
  return (
    <section className={styles.hero}>
      <div>
        <p className={styles.badge}>
          <span /> MESSAGE FORMATTING FOR JAVASCRIPT
        </p>
        <Heading as='h1'>
          I18n <span>made simple.</span>
        </Heading>
        <p className={styles.heroAudience}>For React, React Native, and Next.js.</p>
        <p className={styles.lede}>
          Write messages inline in the code that renders or returns them. Fluentic brings ICU formatting, typed
          descriptors, catalog extraction, and translation tools into one practical workflow.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primary} to='/docs/intro'>
            Get started <span aria-hidden='true'>→</span>
          </Link>
          <Link className={styles.secondary} to='/docs/api'>Explore the API</Link>
        </div>
        <InstallCommand />
        <ul className={styles.highlights}>
          <li>Messages written inline</li>
          <li>Standard ICU syntax</li>
          <li>Automatic translation with review</li>
        </ul>
      </div>
      <div className={styles.workbench}>
        <div className={styles.windowBar}>
          <span className={styles.dots} aria-hidden='true'>
            <i />
            <i />
            <i />
          </span>
          <span className={styles.windowTitle}>i18n made simple.</span>
        </div>
        <div className={styles.heroTabs} role='tablist' aria-label='Message API examples'>
          {heroExamples.map((item, index) => (
            <button
              key={item.id}
              type='button'
              role='tab'
              aria-selected={heroExample === index}
              onClick={() => {
                setHeroExample(index);
                setInPractice(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role='tabpanel'>
          <div className={styles.heroExampleIntro}>
            <Heading as='h3'>{active.title}</Heading>
            <div className={styles.exampleMode} role='group' aria-label='Example detail'>
              <button type='button' aria-pressed={!inPractice} onClick={() => setInPractice(false)}>Basic</button>
              <button type='button' aria-pressed={inPractice} onClick={() => setInPractice(true)}>In practice</button>
            </div>
          </div>
          <div className={styles.heroExampleCode}>
            <CodeBlock language='tsx'>{inPractice ? active.practical : active.files[0].code}</CodeBlock>
          </div>
          <div className={styles.preview}>
            <div className={styles.previewLabel}>
              <span className={styles.outputLabel}>
                <span aria-hidden='true' />EXAMPLE OUTPUT
              </span>
              <div className={styles.locales} role='group' aria-label='Preview language'>
                {locales.map((item, index) => (
                  <button
                    key={item.id}
                    type='button'
                    aria-label={item.name}
                    aria-pressed={locale === index}
                    onClick={() => setLocale(index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.previewMessage} aria-live='polite'>
              <span className={styles.outputText} lang={language.id}>
                {active.id === 'rich'
                  ? (
                    <>
                      {active.output[locale].split('Ada')[0]}
                      <strong>Ada</strong>
                      {active.output[locale].split('Ada')[1]}
                    </>
                  )
                  : active.output[locale]}
              </span>
              <span className={styles.outputCaption}>{language.name} · Example translation</span>
            </div>
          </div>
          <div className={styles.windowFooter}>
            <span>Example {heroExample + 1} of {heroExamples.length} · {active.label}</span>
            <Link to={active.to}>Explore this API ↗</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
