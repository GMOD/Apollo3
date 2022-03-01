module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'plugin:cypress/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: ['eslint-plugin-tsdoc'],
  settings: {
    react: {
      version: 'latest',
    },
  },
  parserOptions: {
    project: 'tsconfig.json',
  },
  rules: {
    '@typescript-eslint/dot-notation': ['warn', { allowKeywords: true }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/lines-between-class-members': [
      'warn',
      'always',
      { exceptAfterSingleLine: true },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
      },
      { selector: 'function', format: ['camelCase', 'PascalCase'] },
      { selector: 'typeLike', format: ['PascalCase'] },
    ],
    '@typescript-eslint/no-shadow': 'error',
    curly: 'warn',
    camelcase: ['error', { properties: 'never', ignoreDestructuring: false }],
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
    'no-return-await': 'error',
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
  },
  overrides: [
    {
      files: ['**/*.js'],
      rules: {
        'tsdoc/syntax': 'off',
      },
    },
  ],
}
