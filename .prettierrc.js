/** @type {import("prettier").Options} */

module.exports = {
  semi: false,
  singleQuote: true,
  proseWrap: 'always',
  plugins: [require('prettier-plugin-import-sort')],
  overrides: [
    {
      files: ['**/devcontainer.json', '.vscode/*.json', '**/tsconfig*.json'],
      options: { parser: 'jsonc' },
    },
  ],
}
