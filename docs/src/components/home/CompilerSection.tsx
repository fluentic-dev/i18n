import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from '../../pages/index.module.css';
import { CodeBlock } from './shared';

export function CompilerSection() {
  return (
    <section className={`${styles.section} ${styles.compiler}`} aria-labelledby='compiled-messages'>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.eyebrow}>Optional build plugin</p>
          <Heading as='h2' id='compiled-messages'>
            Same message API.<br />A smaller runtime.
          </Heading>
        </div>
        <p>
          Compile ICU messages during your build. Ship compact instructions and a small formatter, with no ICU parser or
          {' '}
          <code>intl-messageformat</code> in the compiled runtime.
        </p>
      </div>
      <div className={styles.compilerSizes}>
        <div>
          <strong>
            ~2.2 KB <small>gzip</small>
          </strong>
          <span>Compiled message runtime</span>
          <p>
            The full <code>t</code> API: text, JSX dispatch, descriptors, parameters, and compact ICU formatting.
          </p>
        </div>
        <div>
          <strong>
            ~3.9 KB <small>gzip</small>
          </strong>
          <span>Working React i18n setup</span>
          <p>
            Compiled <code>t</code>, catalog loading, language switching, observable state, and React rendering.
          </p>
        </div>
      </div>
      <p className={styles.compilerFootnote}>
        <Link to='/docs/runtime/compilation#runtime-size-measurements'>See the measurements and scope →</Link>
      </p>
      <div className={styles.directMessages}>
        <div>
          <Heading as='h3'>Enable compilation. Keep writing messages.</Heading>
          <p>
            Set <code>compiled: true</code>, add your build plugin, and regenerate catalogs. Keep importing{' '}
            <code>t</code> from <code>@fluentic/i18n</code>; the plugin selects the compiled entrypoint.
          </p>
          <p>
            Automatic and manual translation files stay readable. Merged catalogs become compact hash/message rows, and
            static context chains disappear from the generated calls.
          </p>
          <p>The default runtime remains available when you prefer setup without a compiler plugin.</p>
        </div>
        <CodeBlock language='ts'>
          {`// i18n.config.ts
import { defineConfig } from '@fluentic/i18n-cli';

export default defineConfig({
  compiled: true,
  languages: { source: 'en', targets: ['fr'] },
  files: { includes: ['src/**/*.{ts,tsx}'] },
});

// vite.config.ts — add to your plugins
import fluentic from '@fluentic/i18n/plugin/vite';
// plugins: [fluentic(), react()]`}
        </CodeBlock>
      </div>
      <nav className={styles.compilerLinks} aria-label='Compiler and platform guides'>
        <Link to='/docs/runtime/compilation'>Compiler guide →</Link>
        <Link to='/docs/runtime/bundlers'>Vite · Rollup · esbuild · webpack · Babel →</Link>
        <Link to='/docs/runtime/react-native'>React Native / Expo →</Link>
        <Link to='/docs/runtime/nextjs'>Next.js →</Link>
      </nav>
    </section>
  );
}
