import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function NavbarLogo() {
  return (
    <Link to='/' className={`navbar__brand ${styles.brand}`} aria-label='Fluentic i18n home'>
      <img className={styles.mark} src={useBaseUrl('/img/logo.svg')} width='40' height='40' alt='' />
      <span className={styles.wordmark} aria-hidden='true'>fluentic/i18n</span>
    </Link>
  );
}
