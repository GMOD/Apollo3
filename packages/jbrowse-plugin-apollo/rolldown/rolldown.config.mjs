/** @type {import('rolldown').RolldownOptions} */

import globals from '@jbrowse/core/ReExports/list'

import { createRolldownConfig } from './createRolldownConfig.mjs'

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

const rolldownConfig = createRolldownConfig(globals, {
  includeUMD,
  includeCJS,
  includeESMBundle,
  includeNPM,
})

for (const config of rolldownConfig) {
  config.onLog = (level, log, defaultHandler) => {
    if (
      log.code === 'MODULE_LEVEL_DIRECTIVE' &&
      log.message.includes(`use client`)
    ) {
      return
    }
    defaultHandler(level, log)
  }
}

export default rolldownConfig
