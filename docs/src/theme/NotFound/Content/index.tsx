import Link from '@docusaurus/Link';
import styles from '../styles.module.css';

type Props = { className?: string; };

export default function NotFoundContent({ className = '' }: Props) {
  return (
    <main className={`${styles.page} ${className}`}>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.codePanel} aria-hidden='true'>
            <span className={styles.line}>404</span>
            <span className={styles.prompt}>
              ~/fluentic/docs <b>→</b> route not found
            </span>
            <span className={styles.cursor} />
          </div>
          <div className={styles.content}>
            <p className={styles.eyebrow}>ROUTE_NOT_FOUND</p>
            <h1>This page is not here.</h1>
            <p className={styles.description}>
              We couldn’t find a page at this address. Head back home to explore Fluentic.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} to='/'>
                Go to homepage <span aria-hidden='true'>→</span>
              </Link>
              <Link className={styles.secondary} to='/docs/intro'>Open the docs</Link>
            </div>
            <nav className={styles.links} aria-label='Helpful links'>
              <Link to='/docs/api'>API reference</Link>
              <Link to='/docs/cli/overview'>CLI guide</Link>
              <Link to='/docs/learn/message-workflow'>How it works</Link>
            </nav>
          </div>
        </div>
      </div>
    </main>
  );
}
