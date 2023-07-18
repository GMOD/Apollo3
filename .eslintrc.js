/** @type {import('eslint').Linter.Config} */

module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:cypress/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:@typescript-eslint/strict',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:prettier/recommended',
  ],
  plugins: ['tsdoc'],
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
      'error',
      { argsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    '@typescript-eslint/return-await': 'error',
    curly: 'warn',
    'import/no-extraneous-dependencies': 'error',
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
    'object-shorthand': 'warn',
    'prefer-destructuring': 'warn',
    'prefer-template': 'warn',
    'prettier/prettier': 'warn',
    radix: 'error',
    'spaced-comment': [
      'warn',
      'always',
      // allow TS /// directives
      { line: { markers: ['/'] } },
    ],
    'tsdoc/syntax': 'warn',
    // will be part of "plugin:@typescript-eslint/recommended-type-checked" when enabled
    '@typescript-eslint/no-floating-promises': 'error',
  },
  overrides: [
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
          createClass: 'createReactClass', // Regex for Component Factory to use,
          // default to "createReactClass"
          pragma: 'React', // Pragma to use, default to "React"
          fragment: 'Fragment', // Fragment to use (may be a property of <pragma>), default to "Fragment"
          version: 'detect', // React version. "detect" automatically picks the version you have installed.
          // You can also use `16.0`, `16.3`, etc, if you want to override the detected value.
          // It will default to "latest" and warn if missing, and to "detect" in the future
          flowVersion: '0.53', // Flow version
        },
        propWrapperFunctions: [
          // The names of any function used to wrap propTypes, e.g. `forbidExtraProps`. If this isn't set, any propTypes wrapped in a function will be skipped.
          'forbidExtraProps',
          { property: 'freeze', object: 'Object' },
          { property: 'myFavoriteWrapper' },
          // for rules that check exact prop wrappers
          { property: 'forbidExtraProps', exact: true },
        ],
        componentWrapperFunctions: [
          // The name of any function used to wrap components, e.g. Mobx `observer` function. If this isn't set, components wrapped by these functions will be skipped.
          'observer', // `property`
          { property: 'styled' }, // `object` is optional
          { property: 'observer', object: 'Mobx' },
          { property: 'observer', object: '<pragma>' }, // sets `object` to whatever value `settings.react.pragma` is set to
        ],
        formComponents: [
          // Components used as alternatives to <form> for forms, eg. <Form endpoint={ url } />
          'CustomForm',
          { name: 'Form', formAttribute: 'endpoint' },
        ],
        linkComponents: [
          // Components used as alternatives to <a> for linking, eg. <Link to={ url } />
          'Hyperlink',
          { name: 'Link', linkAttribute: 'to' },
        ],
      },
    },
    {
      files: ['./packages/jbrowse-plugin-apollo/*.js'],
      parserOptions: {
        project: 'packages/jbrowse-plugin-apollo/tsconfig.eslint.json',
      },
      env: { node: true },
    },
    {
      files: ['./packages/jbrowse-plugin-apollo/cypress/**/*.js'],
      env: { node: true },
    },
    {
      files: ['./packages/apollo-collaboration-server/**/*.ts'],
      env: { node: true },
    },
    {
      files: ['**/*.js'],
      rules: {
        'tsdoc/syntax': 'off',
      },
    },
  ],
}
