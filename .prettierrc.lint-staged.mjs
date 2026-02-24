import packagejson from 'prettier-plugin-packagejson'
/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */
const config = {
  semi: false,
  singleQuote: true,
  proseWrap: 'always',
  overrides: [
    {
      files: ['.devcontainer/**/*.json', '.vscode/*.json', '**/tsconfig*.json'],
      options: { parser: 'jsonc' },
    },
  ],
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [packagejson],
}

export default config
