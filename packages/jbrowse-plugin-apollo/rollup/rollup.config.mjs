/** @type {import('rollup').RollupOptions} */

import globals from '@jbrowse/core/ReExports/list'

import { createRollupConfig } from './createRollupConfig.mjs'

function stringToBoolean(string) {
  if (string === undefined) {
    return
  }
  if (string === 'true') {
    return true
  }
  if (string === 'false') {
    return false
  }
  throw new Error('unknown boolean string')
}

const includeUMD = stringToBoolean(process.env.JB_UMD)
const includeCJS = stringToBoolean(process.env.JB_CJS)
const includeESMBundle = stringToBoolean(process.env.JB_ESM_BUNDLE)
const includeNPM = stringToBoolean(process.env.JB_NPM)

const rollupConfig = createRollupConfig(globals, {
  includeUMD,
  includeCJS,
  includeESMBundle,
  includeNPM,
})

for (const config of rollupConfig) {
  config.onwarn = (warning, warn) => {
    if (
      warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
      warning.message.includes(`use client`)
    ) {
      return
    }
    warn(warning)
  }
}

export default rollupConfig
