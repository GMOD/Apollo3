/** @type {import("prettier").Options} */

module.exports = {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  proseWrap: 'always',
  plugins: [
    require('prettier-plugin-import-sort'),
  ],
}
