module.exports = {
  extends: [
    'react-app',
    'react-app/jest',
    'plugin:cypress/recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
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
    '@typescript-eslint/no-shadow': 'error',
    curly: 'warn',
    'import/no-extraneous-dependencies': 'error',
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    'no-else-return': ['error', { allowElseIf: false }],
    'no-return-await': 'error',
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
  },
}
