import CodeBlock from '@theme/CodeBlock';
import { useEffect, useState } from 'react';
import styles from '../../pages/index.module.css';

export function InlineCode({ text }: { text: string; }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, index) =>
        part.startsWith('`') && part.endsWith('`')
          ? <code className={styles.inlineCode} key={index}>{part.slice(1, -1)}</code>
          : part
      )}
    </>
  );
}

export function InstallCommand() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);
  const label = status === 'copied' ? 'Copied!' : 'Copy install command';
  return (
    <div className={styles.install}>
      <span aria-hidden='true'>$</span>
      <code>pnpm add @fluentic/i18n @fluentic/i18n-web</code>
      <button
        type='button'
        className={styles.installCopy}
        aria-label={label}
        title={label}
        data-copied={status === 'copied'}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText('pnpm add @fluentic/i18n @fluentic/i18n-web');
            setStatus('copied');
          } catch {
            setStatus('error');
          }
        }}
      >
        <svg
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.7'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          {status === 'copied' ? <path d='m5 12 4 4L19 6' /> : (
            <>
              <rect x='8' y='8' width='12' height='12' rx='2' />
              <path d='M16 4H6a2 2 0 0 0-2 2v10' />
            </>
          )}
        </svg>
      </button>
      <span className={styles.copyStatus} role='status'>
        {status === 'copied'
          ? 'Command copied'
          : status === 'error'
          ? 'Unable to copy. Select and copy the command.'
          : ''}
      </span>
    </div>
  );
}

export { CodeBlock };
