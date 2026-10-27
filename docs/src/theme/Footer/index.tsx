import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.identity}>
          <Link to='/' className={styles.brand} aria-label='Fluentic i18n home'>
            <img src={useBaseUrl('/img/logo.svg')} width='32' height='32' alt='' />
            <span>fluentic/i18n</span>
          </Link>
          <span className={styles.copyright}>© {new Date().getFullYear()} Fluentic</span>
        </div>
        <nav className={styles.links} aria-label='Footer navigation'>
          <span className={styles.license}>MIT licensed</span>
          <Link to='/docs/intro'>Docs</Link>
          <a href='https://github.com/fluentic-dev/i18n' target='_blank' rel='noopener noreferrer'>
            GitHub <span aria-hidden='true'>↗</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
