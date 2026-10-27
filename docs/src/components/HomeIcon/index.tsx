import styles from './styles.module.css';

// One optical grid and stroke weight for every homepage card.
const icons: Record<string, { path: string; tone: string; }> = {
  message: {
    tone: 'violet',
    path: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M9 8h6 M9 12h6 M9 16h3',
  },
  code: { tone: 'blue', path: 'M8 7 3 12l5 5 M16 7l5 5-5 5 M13 5l-2 14' },
  text: { tone: 'teal', path: 'M4 6h16 M12 6v14 M8 20h8 M4 6v3 M20 6v3' },
  context: {
    tone: 'blue',
    path: 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8l-5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M7 9h10 M7 13h6',
  },
  rich: { tone: 'violet', path: 'M7 4v8a5 5 0 0 0 10 0V4 M4 21h16' },
  switch: { tone: 'teal', path: 'M4 8h15l-4-4 M20 16H5l4 4 M19 8l-4 4 M5 16l4-4' },
  check: { tone: 'violet', path: 'M5 3h10l4 4v5 M15 3v5h4 M5 3v18h7 M8 8h3 M8 12h4 M14 18l3 3 5-6' },
  components: { tone: 'blue', path: 'M3 3h7v7H3Z M14 14h7v7h-7Z M14 6h4v4 M6 14v4h4' },
  merge: { tone: 'violet', path: 'M5 4v4c0 4 7 3 7 7 M19 4v4c0 4-7 3-7 7 M12 15v6 M8 17l4 4 4-4' },
  translate: { tone: 'lime', path: 'M3 5h11 M8 3v2 M12 5c-1 6-5 9-9 11 M5 8c1 3 4 6 8 8 M14 21l4-10 4 10 M16 17h4' },
  exchange: { tone: 'teal', path: 'M3 7h17 M16 3l4 4-4 4 M21 17H4 M8 13l-4 4 4 4' },
  download: { tone: 'teal', path: 'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5' },
  extract: { tone: 'violet', path: 'M4 3h10l4 4v4 M14 3v5h4 M4 3v18h7 M8 8h2 M8 12h3 M14 17h8 M18 13l4 4-4 4' },
  review: { tone: 'blue', path: 'M12 4H4v16h16v-8 M10 14l1-4 8-8 3 3-8 8-4 1Z' },
};

export default function HomeIcon({ name }: { name: string; }) {
  const icon = icons[name];
  return (
    <span className={styles.box} data-tone={icon.tone} aria-hidden='true'>
      <svg
        width='24'
        height='24'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.7'
        strokeLinecap='round'
        strokeLinejoin='round'
        focusable='false'
      >
        <path d={icon.path} />
      </svg>
    </span>
  );
}
