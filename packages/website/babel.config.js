module.exports = {
  presets: [require.resolve('@docusaurus/core/lib/babel/preset')],
  // Some theme packages, like docusaurus-theme-openapi-docs, are CommonJS.
  // Docusaurus transpiles them, and without this Babel treats them as ES
  // modules and adds `import`s of its helpers, which breaks their `exports`.
  sourceType: 'unambiguous',
}
