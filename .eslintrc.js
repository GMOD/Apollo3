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
      version: 'detect',
    },
  },
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-var-requires': 0, // KS 12.11.2021: To get rid of 'Require statement not part of import statement' -error
    'prettier/prettier': 'warn',
  },
}
