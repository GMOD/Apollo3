/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// Instruments the plugin's own source for coverage collection in Cypress (via
// @cypress/code-coverage). Rolldown strips TypeScript after plugin transforms
// run, so this parses the original .ts/.tsx source directly and passes along
// the combined source map so coverage maps back to the original files.

import path from 'node:path'

import { createInstrumenter, defaultOpts } from 'istanbul-lib-instrument'

/** @param {string[]} extraParserPlugins */
function makeInstrumenter(extraParserPlugins) {
  return createInstrumenter({
    esModules: true,
    produceSourceMap: true,
    parserPlugins: [...defaultOpts.parserPlugins, ...extraParserPlugins],
  })
}

/** @param {{ srcPath: string }} options */
export function istanbul({ srcPath }) {
  // JSX parsing is only enabled for .tsx, since it conflicts with <T> type
  // assertions in .ts files
  const tsInstrumenter = makeInstrumenter(['typescript'])
  const tsxInstrumenter = makeInstrumenter(['typescript', 'jsx'])
  return {
    name: 'istanbul',
    /**
     * @param {string} code
     * @param {string} id
     */
    transform(code, id) {
      if (
        !id.startsWith(srcPath + path.sep) ||
        !/\.tsx?$/.test(id) ||
        /\.test\.tsx?$/.test(id)
      ) {
        return
      }
      const instrumenter = id.endsWith('.tsx')
        ? tsxInstrumenter
        : tsInstrumenter
      const instrumented = instrumenter.instrumentSync(
        code,
        id,
        this.getCombinedSourcemap(),
      )
      return { code: instrumented, map: instrumenter.lastSourceMap() }
    },
  }
}
