/** @type {import("prettier").Options} */

module.exports = {
  semi: false,
  singleQuote: true,
  proseWrap: 'always',
  overrides: [
    {
      files: ['.devcontainer/**/*.json', '.vscode/*.json', '**/tsconfig*.json'],
      options: { parser: 'jsonc' },
    },
  ],
}
