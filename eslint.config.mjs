import js from '@eslint/js'
import pluginCypress from 'eslint-plugin-cypress/flat'
import pluginImport from 'eslint-plugin-import'
import pluginJSXA11y from 'eslint-plugin-jsx-a11y'
import pluginReact from 'eslint-plugin-react'
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
      'packages/website/.docusaurus/',
      'packages/jbrowse-plugin-apollo/.jbrowse/',
    ],
  },
  js.configs.recommended,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  pluginUnicorn.configs['flat/recommended'],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  pluginImport.flatConfigs.typescript,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  pluginReact.configs.flat.recommended,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  pluginJSXA11y.flatConfigs.recommended,
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  pluginCypress.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ['packages/jbrowse-plugin-apollo/*.js'],
        },
        defaultProject: 'tsconfig.json',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: { react: { version: 'detect' } },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    plugins: { tsdoc: pluginTSDoc, import: pluginImport },
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
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        { allowNumber: true },
      ],
      '@typescript-eslint/return-await': 'error',
      // eslint-plugin-import rules
      'import/export': 'error',
      'import/no-duplicates': 'warn',
      'import/no-extraneous-dependencies': 'error',
      'import/no-named-as-default': 'warn',
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
    name: 'eslint-plugin-react-hooks/recommended',
    files: [
      'packages/jbrowse-plugin-apollo/src/**/*.{jsx,tsx}',
      'packages/website/src/**/*.{jsx,tsx}',
    ],
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    plugins: { 'react-hooks': pluginReactHooks },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    rules: { ...pluginReactHooks.configs.recommended.rules },
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
]
