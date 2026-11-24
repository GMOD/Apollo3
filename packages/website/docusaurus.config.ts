import { readFileSync } from 'node:fs'

import type * as Preset from '@docusaurus/preset-classic'
import remarkPluginNpm2Yarn from '@docusaurus/remark-plugin-npm2yarn'
import type { Config } from '@docusaurus/types'
import type * as OpenApiPlugin from 'docusaurus-plugin-openapi-docs'
import { themes as prismThemes } from 'prism-react-renderer'

import sidebarItemsGenerator from './sidebarItemsGenerator'

// Where `yarn gen-api-docs` writes the REST API endpoint pages.
// sidebarItemsGenerator.ts puts them in the sidebar.
const restApiReferenceDir = 'docs/03-multi-user/03-guides/05-rest-api/reference'

// The released Apollo version shown on the homepage. Release tags (vX.Y.Z)
// match the plugin package's version.
const { version: apolloVersion } = JSON.parse(
  readFileSync(
    new URL('../jbrowse-plugin-apollo/package.json', import.meta.url),
    'utf8',
  ),
) as { version: string }

const config: Config = {
  title: 'Apollo',
  tagline:
    'Collaborative, customizable, and scalable graphical genome annotation',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://apollo.jbrowse.org',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'GMOD', // Usually your GitHub org/user name.
  projectName: 'Apollo3', // Usually your repo name.

  onBrokenLinks: 'throw',

  customFields: { apolloVersion },

  trailingSlash: false,

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          sidebarItemsGenerator,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/GMOD/Apollo3/tree/main/packages/website/',
          remarkPlugins: [[remarkPluginNpm2Yarn, { sync: true }]],
          // Renders the REST API endpoint pages, and other docs as usual
          docItemComponent: '@theme/ApiItem',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // Generates the REST API endpoint pages from the collaboration server's
    // OpenAPI document when running `yarn gen-api-docs`
    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'openapi',
        docsPluginId: 'classic',
        config: {
          collaborationServer: {
            specPath: '../apollo-collaboration-server/openapi.json',
            outputDir: restApiReferenceDir,
            showInfoPage: false,
            // The plugin's default page template, except that the sidebar
            // shows each endpoint's path rather than its summary. The page's
            // sidebar_label front matter overrides any label set in the
            // sidebar, so this has to be done in the template.
            template: 'openapi-templates/api.mustache',
            sidebarOptions: {
              groupPathsBy: 'tag',
              categoryLinkSource: 'tag',
            },
          } satisfies OpenApiPlugin.Options,
        },
      },
    ],
  ],

  themes: ['docusaurus-theme-openapi-docs'],

  themeConfig: {
    // Preview image for links shared on social media and chat apps (1200×630)
    image: 'img/social-card.png',
    // Code sample languages on the REST API endpoint pages. Only the languages
    // listed here are shown, in this order. The other settings for each
    // language come from the theme's defaults.
    languageTabs: [
      'javascript',
      'nodejs',
      'csharp',
      'curl',
      'dart',
      'go',
      'http',
      'java',
      'kotlin',
      'c',
      'objective-c',
      'ocaml',
      'php',
      'postman-cli',
      'powershell',
      'python',
      'r',
      'ruby',
      'rust',
      'shell',
      'swift',
    ].map((language) => ({ language })),
    navbar: {
      title: 'Apollo',
      logo: {
        alt: 'Apollo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        { to: 'blog', label: 'Blog', position: 'left' },
        { to: 'contact', label: 'Contact', position: 'left' },
        {
          href: 'https://github.com/GMOD/Apollo3',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: 'docs' },
            { label: 'User guide', to: 'docs/user-guide' },
            { label: 'Single-user setup', to: 'docs/single-user' },
            { label: 'Multi-user setup', to: 'docs/multi-user' },
            { label: 'Developer guide', to: 'docs/developer-guide' },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discussions',
              href: 'https://github.com/GMOD/Apollo3/discussions',
            },
            {
              label: 'Report a bug',
              href: 'https://github.com/GMOD/Apollo3/issues/new/choose',
            },
            { label: 'Contact', to: 'contact' },
            { label: 'Blog', to: 'blog' },
          ],
        },
        {
          title: 'More',
          items: [
            { label: 'GitHub', href: 'https://github.com/GMOD/Apollo3' },
            { label: 'Cite Apollo', to: '/#cite' },
            {
              label: 'License',
              href: 'https://github.com/GMOD/Apollo3/blob/main/LICENSE',
            },
            {
              label: 'Code of conduct',
              href: 'https://github.com/GMOD/Apollo3/blob/main/CODE_OF_CONDUCT.md',
            },
            { label: 'JBrowse', href: 'https://jbrowse.org' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Evolutionary Software Foundation, Inc. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.vsLight,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['docker', 'shell-session', 'bash'],
    },
    respectPrefersColorScheme: true,
    api: {
      // Only keep the token for the browser tab, not across sessions
      authPersistance: 'sessionStorage',
      schemaExpansion: { default: 1 },
    },
  } satisfies Preset.ThemeConfig,
}

export default config
