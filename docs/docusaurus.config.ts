import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const docsSite = process.env.DOCS_SITE ?? 'https://fluentic.dev';
const configuredBase = process.env.DOCS_BASE ?? '/';
const docsBase = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;

const config: Config = {
  title: 'Fluentic i18n',
  tagline: 'Internationalization for React and JavaScript.',
  favicon: 'img/favicon.svg',
  url: docsSite,
  baseUrl: docsBase,
  organizationName: 'fluentic-dev',
  projectName: 'i18n',
  onBrokenLinks: 'throw',
  presets: [['classic', {
    docs: { sidebarPath: './sidebars.ts', routeBasePath: 'docs', showLastUpdateTime: false },
    blog: false,
    theme: { customCss: './src/css/custom.css' },
  }]],
  themeConfig: {
    image: 'img/fluentic-social-card.svg',
    navbar: {
      title: 'fluentic/i18n',
      logo: { alt: '', src: 'img/logo.svg' },
      items: [
        { type: 'doc', docId: 'intro', label: 'Docs', position: 'left', activeBaseRegex: '/docs/(?!api|cli)' },
        { type: 'doc', docId: 'api', label: 'API', position: 'left', activeBaseRegex: '/docs/api' },
        { type: 'doc', docId: 'cli/overview', label: 'CLI', position: 'left', activeBaseRegex: '/docs/cli' },
        {
          href: 'https://github.com/fluentic-dev/i18n',
          label: 'GitHub',
          position: 'right',
          className: 'navbar-github',
        },
        { type: 'doc', docId: 'intro', label: 'Get started', position: 'right', className: 'navbar-cta' },
      ],
    },
    footer: { copyright: 'Fluentic i18n · React, JavaScript, and ICU.' },
    colorMode: { defaultMode: 'light', respectPrefersColorScheme: true },
    prism: {
      theme: {
        ...prismThemes.github,
        plain: { color: '#334155', backgroundColor: '#ffffff' },
        styles: [
          { types: ['comment', 'prolog'], style: { color: '#64748b', fontStyle: 'normal' } },
          { types: ['keyword', 'tag'], style: { color: '#6338b5' } },
          { types: ['string', 'attr-value'], style: { color: '#17734b' } },
          { types: ['function', 'class-name'], style: { color: '#2055b6' } },
          { types: ['number', 'boolean'], style: { color: '#a54816' } },
          { types: ['operator', 'punctuation'], style: { color: '#59667b' } },
          { types: ['property', 'attr-name'], style: { color: '#974065' } },
        ],
      },
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'json'],
    },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
  },
};
export default config;
