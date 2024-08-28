/** @type {import('eslint').Linter.Config} */

module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:unicorn/recommended',
    'plugin:cypress/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
  ],
  plugins: ['import', 'tsdoc', 'sort-destructure-keys'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
  },
  env: { 'shared-node-browser': true },
  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },
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
    quotes: ['error', 'single', { avoidEscape: true }],
    radix: 'error',
    'spaced-comment': [
      'warn',
      'always',
      // allow TS /// directives
      { line: { markers: ['/'] } },
    ],
    // @typescript-eslint/eslint-plugin rules (override recommended)
    '@typescript-eslint/lines-between-class-members': [
      'warn',
      'always',
      { exceptAfterSingleLine: true },
    ],
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
    // eslint-plugin-sort-destructure-keys rules
    'sort-destructure-keys/sort-destructure-keys': 'warn',
    // eslint-plugin-tsdoc rules
    'tsdoc/syntax': 'warn',
    // eslint-plugin-unicorn rules (override recommended)
    'unicorn/filename-case': 'off', // Doesn't match our file naming, maybe can be configured later
    'unicorn/no-empty-file': 'off', // False positives
    'unicorn/no-null': 'off', // A lot of null in React and other libraries
    'unicorn/prefer-module': 'off', // Cypress and apollo-collaboration-server need this
    'unicorn/prevent-abbreviations': 'off', // Doesn't guess a lot of abbreviations correctly
  },
  overrides: [
    // Only use React-specific lint rules in jbrowse-plugin-apollo
    {
      files: ['./packages/jbrowse-plugin-apollo/**/*.{ts,tsx}'],
      env: { browser: true },
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
      ],
      settings: {
        // These settings are from eslint-plugin-react
        react: {
          // React version. "detect" automatically picks the version you have installed.
          // You can also use `16.0`, `16.3`, etc, if you want to override the detected value.
          // It will default to "latest" and warn if missing, and to "detect" in the future
          version: 'detect',
        },
        componentWrapperFunctions: [
          // The name of any function used to wrap components, e.g. Mobx `observer` function. If this isn't set, components wrapped by these functions will be skipped.
          'observer', // `property`
          { property: 'styled' }, // `object` is optional
          { property: 'observer', object: 'Mobx' },
          { property: 'observer', object: '<pragma>' }, // sets `object` to whatever value `settings.react.pragma` is set to
        ],
      },
    },
    // Lint non-src JS files (e.g. jest.config.js) using a separate tsconfig
    {
      files: ['./packages/jbrowse-plugin-apollo/*.js'],
      parserOptions: {
        project: 'packages/jbrowse-plugin-apollo/tsconfig.eslint.json',
      },
      env: { node: true },
    },
    {
      files: ['./packages/apollo-cli/*.{c,}js'],
      parserOptions: {
        project: 'packages/apollo-cli/tsconfig.eslint.json',
      },
      env: { node: true },
    },
    // Specify Node env and tsconfig for cypress testing and config files
    {
      files: [
        './packages/jbrowse-plugin-apollo/cypress.config.js',
        './packages/jbrowse-plugin-apollo/cypress/**/*.{j,t}s',
      ],
      parserOptions: {
        project: 'packages/jbrowse-plugin-apollo/cypress/tsconfig.json',
      },
      env: { node: true },
    },
    // Specify Node env for apollo-collaboration-server/
    {
      files: ['./packages/apollo-collaboration-server/**/*.ts'],
      env: { node: true },
    },
    // Don't enforce tsdoc syntax in JS files
    {
      files: ['**/*.js'],
      rules: {
        'tsdoc/syntax': 'off',
      },
    },
  ],
}
