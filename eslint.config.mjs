import js from '@eslint/js'
import pluginReact from '@eslint-react/eslint-plugin'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import pluginCypress from 'eslint-plugin-cypress/flat'
import pluginImportX from 'eslint-plugin-import-x'
import pluginJSXA11y from 'eslint-plugin-jsx-a11y-x'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginTSDoc from 'eslint-plugin-tsdoc'
import pluginUnicorn from 'eslint-plugin-unicorn'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      '.pnp.*',
      '.yarn/',
      '**/bin/',
      '**/build/',
      '**/coverage/',
      '**/dist/',
      '**/__fixtures__/',
      'packages/website/.docusaurus/',
      'packages/jbrowse-plugin-apollo/.jbrowse/',
    ],
  },
  js.configs.recommended,
  pluginUnicorn.configs.recommended,
  pluginImportX.flatConfigs.typescript,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true },
    },
    plugins: {
      tsdoc: pluginTSDoc,
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      // eslint built-in rules (override recommended)
      curly: 'warn',
      'new-cap': [
        'error',
        {
          newIsCap: true,
          newIsCapExceptions: [],
          capIsNew: false,
          capIsNewExceptions: [
            'Immutable.Map',
            'Immutable.Set',
            'Immutable.List',
          ],
        },
      ],
      'no-console': ['warn', { allow: ['error', 'warn', 'debug'] }],
      'no-else-return': ['error', { allowElseIf: false }],
      'no-extra-semi': 'off',
      'object-shorthand': 'warn',
      'prefer-destructuring': 'warn',
      'prefer-template': 'warn',
      radix: 'error',
      // @typescript-eslint/eslint-plugin rules (override recommended)
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        { allowNumber: true },
      ],
      '@typescript-eslint/return-await': 'error',
      // eslint-plugin-import-x rules
      'import-x/export': 'error',
      'import-x/no-duplicates': ['warn', { 'prefer-inline': true }],
      'import-x/no-extraneous-dependencies': 'error',
      'import-x/no-named-as-default': 'warn',
      'import-x/order': [
        'warn',
        {
          named: true,
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
          groups: ['builtin', 'external', 'parent', 'sibling'],
        },
      ],
      // eslint-plugin-tsdoc rules
      'tsdoc/syntax': 'warn',
      // eslint-plugin-unicorn rules (override recommended)
      'unicorn/filename-case': 'off', // Doesn't match our file naming, maybe can be configured later
      'unicorn/no-empty-file': 'off', // False positives
      'unicorn/no-null': 'off', // A lot of null in React and other libraries
      'unicorn/prefer-module': 'off', // Cypress and apollo-collaboration-server need this
      'unicorn/prevent-abbreviations': 'off', // Doesn't guess a lot of abbreviations correctly
    },
  },
  {
    ...pluginReactHooks.configs.flat.recommended,
    files: [
      'packages/jbrowse-plugin-apollo/src/**/*.{jsx,tsx}',
      'packages/website/src/**/*.{jsx,tsx}',
    ],
  },
  {
    ...pluginReact.configs['disable-conflict-eslint-plugin-react-hooks'],
    files: [
      'packages/jbrowse-plugin-apollo/src/**/*.{jsx,tsx}',
      'packages/website/src/**/*.{jsx,tsx}',
    ],
  },
  {
    ...pluginReact.configs['recommended-typescript'],
    files: [
      'packages/jbrowse-plugin-apollo/src/**/*.{jsx,tsx}',
      'packages/website/src/**/*.{jsx,tsx}',
    ],
  },
  {
    ...pluginJSXA11y.configs.recommended,
    files: [
      'packages/jbrowse-plugin-apollo/src/**/*.{jsx,tsx}',
      'packages/website/src/**/*.{jsx,tsx}',
    ],
  },
  {
    ...pluginCypress.configs.recommended,
    files: ['packages/jbrowse-plugin-apollo/cypress/**/*'],
  },
  // Don't enforce tsdoc syntax in JS files
  {
    files: ['*.{c,m,}js', '**/*.{c,m,}js'],
    rules: {
      'tsdoc/syntax': 'off',
    },
  },
  {
    files: ['packages/apollo-cli/src/**/*.ts'],
    rules: { '@typescript-eslint/no-deprecated': 'off' },
  },
  // The collaboration server logs exclusively through Nest's Logger
  {
    files: ['packages/apollo-collaboration-server/src/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
]
