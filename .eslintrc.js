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
      version: 'detect',
    },
  },
  parserOptions: {
    project: 'tsconfig.json',
  },
  rules: {
    '@typescript-eslint/array-type': 'warn',
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
    // from @typescript-eslint/recommended-requiring-type-checking
    // TODO: Once we can enable all of these, remove the individual rules and
    // enable recommended-requiring-type-checking in the "extends" above
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-for-in-array': 'error',
    'no-implied-eval': 'off',
    '@typescript-eslint/no-implied-eval': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    // '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    // '@typescript-eslint/no-unsafe-argument': 'error',
    // '@typescript-eslint/no-unsafe-assignment': 'error',
    // '@typescript-eslint/no-unsafe-call': 'error',
    // '@typescript-eslint/no-unsafe-member-access': 'error',
    // '@typescript-eslint/no-unsafe-return': 'error',
    // 'require-await': 'off',
    // '@typescript-eslint/require-await': 'error',
    // '@typescript-eslint/restrict-plus-operands': 'error',
    // '@typescript-eslint/restrict-template-expressions': 'error',
    // '@typescript-eslint/unbound-method': 'error',
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
