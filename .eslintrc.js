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
  },
}
