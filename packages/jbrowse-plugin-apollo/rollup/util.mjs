/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import fs from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'

export function safePackageName(name) {
  return name
    .toLowerCase()
    .replaceAll(/(^@.*\/)|((^[^a-zA-Z]+)|[^\w.-])|([^a-zA-Z0-9]+$)/g, '')
}

export function external(id) {
  if (id.startsWith('regenerator-runtime')) {
    return false
  }
  return !id.startsWith('.') && !path.isAbsolute(id)
}

export function writeIndex(packageName, distPath) {
  return {
    name: 'write-index-file',
    generateBundle() {
      const baseLine = `module.exports = require('./${packageName}`
      const contents = `'use strict'

if (process.env.NODE_ENV === 'production') {
${baseLine}.cjs.production.min.js')
} else {
${baseLine}.cjs.development.js')
}
`
      if (!fs.existsSync(distPath)) {
        fs.mkdirSync(distPath, { recursive: true })
      }
      fs.writeFileSync(path.join(distPath, 'index.js'), contents)
    },
  }
}

export function omitUnresolved() {
  const suffix = '?unresolved'
  return {
    name: 'logger',
    async resolveId(source, importer, options) {
      const resolution = await this.resolve(source, importer, {
        skipSelf: true,
        ...options,
      })
      if (!resolution) {
        return `${source}${suffix}`
      }
      return null
    },
    load(id) {
      if (id.endsWith(suffix)) {
        const importee = id.slice(0, -suffix.length)
        console.warn(
          chalk.bold.yellow(
            `Omitting ${importee} from the build because it could not be resolved`,
          ),
        )
        return `export default {};`
      }
      return null
    },
  }
}
