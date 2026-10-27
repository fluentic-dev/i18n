import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import { useState } from 'react';
import styles from '../../pages/index.redesign.module.css';
import { examples } from './data';
import { CodeBlock, InlineCode } from './shared';

export function WorkbenchSection() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = examples[selectedIndex];
  return (
    <section className={styles.section}>
      <p className={styles.eyebrow}>Developer workbench</p>
      <Heading as='h2'>A small API for real-world messages.</Heading>
      <p className={styles.sectionIntro}>
        Explore tags, plural rules, shared messages, and the context your translators need.
      </p>
      <div className={styles.demo}>
        <div className={styles.demoTabs} role='group' aria-label='Code examples'>
          {examples.map((item, index) => (
            <button
              key={item.label}
              type='button'
              aria-pressed={selectedIndex === index}
              onClick={() => setSelectedIndex(index)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={styles.demoContent}>
          <CodeBlock language='tsx' title={selected.file}>{selected.code}</CodeBlock>
          <aside>
            <p className={styles.eyebrow}>Why it works</p>
            <Heading as='h3'>{selected.title}</Heading>
            <p>
              <InlineCode text={selected.text} />
            </p>
            <Link to={selected.to}>Read the guide ↗</Link>
            <div className={styles.exampleOutput}>
              <span>EXAMPLE OUTPUT</span>
              <p>{selected.output}</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
