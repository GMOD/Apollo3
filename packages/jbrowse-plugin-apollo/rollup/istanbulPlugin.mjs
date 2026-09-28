/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// Instruments the plugin's own source for coverage collection in Cypress (via
// @cypress/code-coverage). Runs after the TypeScript plugin and passes along
// the combined source map so coverage maps back to the original .ts/.tsx files.

import path from 'node:path'

import { createInstrumenter } from 'istanbul-lib-instrument'

/** @param {{ srcPath: string }} options */
export function istanbul({ srcPath }) {
  const instrumenter = createInstrumenter({
    esModules: true,
    produceSourceMap: true,
  })
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
      const instrumented = instrumenter.instrumentSync(
        code,
        id,
        this.getCombinedSourcemap(),
      )
      return { code: instrumented, map: instrumenter.lastSourceMap() }
    },
  }
}
