// @docusaurus/module-type-aliases declares *.svg but not *.png; webpack
// resolves a PNG import to its URL
declare module '*.png' {
  const src: string
  export default src
}
