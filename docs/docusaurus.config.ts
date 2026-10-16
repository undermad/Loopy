import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Loopy',
  tagline: 'Desktop tool for game design and project management',
  url: 'https://OWNER_PLACEHOLDER.github.io',
  baseUrl: '/Loopy/',
  organizationName: 'OWNER_PLACEHOLDER',
  projectName: 'Loopy',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } },
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: './sidebars.ts', showLastUpdateTime: false },
        blog: false,
        pages: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],
  themes: [
    ['@easyops-cn/docusaurus-search-local', { hashed: true, docsRouteBasePath: '/', indexBlog: false }],
  ],
  themeConfig: {
    colorMode: { defaultMode: 'light', respectPrefersColorScheme: true },
    navbar: {
      title: 'Loopy',
      items: [{ href: 'https://github.com/OWNER_PLACEHOLDER/Loopy', label: 'GitHub', position: 'right' }],
    },
    footer: { style: 'dark', copyright: `Loopy documentation. Built with Docusaurus.` },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
