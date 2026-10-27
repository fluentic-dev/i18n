import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'category',
      label: 'Getting started',
      collapsible: false,
      items: ['intro', 'cli/overview', 'runtime/manager', 'learn/formatting'],
    },
    {
      type: 'category',
      label: 'Message syntax',
      collapsible: false,
      items: ['learn/icu', 'learn/tags', 'learn/metadata'],
    },
    {
      type: 'category',
      label: 'Translation tooling',
      collapsible: false,
      items: ['cli/configuration', 'cli/translators', 'cli/formats', 'cli/hash'],
    },
    {
      type: 'category',
      label: 'Runtime integration',
      collapsible: false,
      items: [
        'runtime/loading',
        'runtime/state',
        'runtime/platforms',
        'runtime/compilation',
        'runtime/bundlers',
        'runtime/react-web',
        'runtime/react-native',
        'runtime/nextjs',
        'runtime/migration',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      collapsible: false,
      items: ['learn/message-workflow', 'api'],
    },
  ],
};
export default sidebars;
