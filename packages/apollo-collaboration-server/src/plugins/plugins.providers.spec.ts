import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MODULE_METADATA } from '@nestjs/common/constants.js'

import { PluginsService } from './plugins.service.js'

/** `PluginsService` installs plugins in `onModuleInit`, so any module that
 * lists it in its own `providers` gets a second instance and every plugin is
 * installed twice. It must only be provided by the global `PluginsModule`. */
describe('PluginsService provider', () => {
  it('is not re-provided by any module other than PluginsModule', async () => {
    const srcDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
    )
    const entries = await readdir(srcDir, { recursive: true })
    const moduleFiles = entries.filter(
      (entry) =>
        entry.endsWith('.module.ts') &&
        !entry.endsWith('plugins.module.ts') &&
        !entry.endsWith('app.module.ts'),
    )
    expect(moduleFiles.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const moduleFile of moduleFiles) {
      const moduleExports = (await import(
        path.join(srcDir, moduleFile)
      )) as Record<string, unknown>
      for (const exported of Object.values(moduleExports)) {
        if (typeof exported !== 'function') {
          continue
        }
        const providers = (Reflect.getMetadata(
          MODULE_METADATA.PROVIDERS,
          exported,
        ) ?? []) as unknown[]
        if (providers.includes(PluginsService)) {
          offenders.push(moduleFile)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
