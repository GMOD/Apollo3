import fs from 'node:fs'
import path from 'node:path'

import nodePolyfills from '@rolldown/plugin-node-polyfills'
import nodeBuiltins from 'builtin-modules'
import { defineConfig } from 'rolldown'
import rollupExternalGlobals from 'rollup-plugin-external-globals'

import { istanbul } from './istanbulPlugin.mjs'
import {
  esModuleInterop,
  external,
  omitUnresolved,
  safePackageName,
  writeIndex,
} from './util.mjs'

const appPath = fs.realpathSync(process.cwd())
const packageJsonPath = path.join(appPath, 'package.json')
const packageJsonText = fs.readFileSync(packageJsonPath, 'utf8')
/** @type {{ name?: string, config?: { jbrowse?: { plugin?: { name?: string } } } }} */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const packageJson = JSON.parse(packageJsonText)
const packageName = safePackageName(packageJson.name ?? '')
const umdName = `JBrowsePlugin${packageJson.config?.jbrowse?.plugin?.name}`

const distPath = path.join(appPath, 'dist')
const srcPath = path.join(appPath, 'src')

const nodeEnv = process.env.NODE_ENV ?? 'production'

const resolve = {
  mainFields: ['module', 'main', 'browser'],
}

/**
 * @param {string[]} jbrowseGlobals
 * @param {boolean} [dotSyntax]
 */
function createGlobalMap(jbrowseGlobals, dotSyntax = false) {
  /** @type {Record<string, string>} */
  const globalMap = {}
  for (const global of jbrowseGlobals) {
    globalMap[global] = dotSyntax
      ? `JBrowseExports.${global}`
      : `JBrowseExports["${global}"]`
  }
  return globalMap
}

/**
 * @param {'cjs' | 'esmBundle' | 'umd'} mode
 * @param {string[]} jbrowseGlobals
 * @returns {import('rolldown').RolldownPluginOption}
 */
function getPlugins(mode, jbrowseGlobals) {
  // tsc resolves these plugins' types, but typescript-eslint sees some of them
  // as error types
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return [
    // Instrument the UMD bundle (the one Cypress loads) for coverage
    mode === 'umd' && process.env.COVERAGE === 'true' && istanbul({ srcPath }),
    rollupExternalGlobals(createGlobalMap(jbrowseGlobals)),
    (mode === 'esmBundle' || mode === 'umd') && nodePolyfills(),
    (mode === 'cjs' || mode === 'esmBundle') && omitUnresolved(),
    esModuleInterop(),
  ].filter(Boolean)
}

/**
 * @param {string[]} jbrowseGlobals
 * @param {{
 *   includeUMD?: boolean | undefined
 *   includeCJS?: boolean | undefined
 *   includeESMBundle?: boolean | undefined
 *   includeNPM?: boolean | undefined
 * }} [options]
 */
export function createRolldownConfig(jbrowseGlobals, options) {
  const includeUMD =
    options?.includeUMD === true || options?.includeUMD === undefined
  const includeCJS = options?.includeCJS === true
  const includeESMBundle = options?.includeESMBundle === true
  const includeNPM =
    options?.includeNPM === true || options?.includeNPM === undefined
  const npmConfig =
    includeNPM &&
    defineConfig({
      input: path.join(srcPath, 'index.ts'),
      external,
      resolve,
      treeshake: { propertyReadSideEffects: false },
      plugins: [writeIndex(packageName, distPath)],
      output: [
        {
          file: path.join(distPath, 'index.esm.js'),
          format: 'esm',
          esModule: true,
          sourcemap: true,
          exports: 'named',
          codeSplitting: false,
        },
        {
          file: path.join(distPath, `${packageName}.cjs.development.js`),
          format: 'cjs',
          esModule: true,
          sourcemap: true,
          exports: 'named',
          codeSplitting: false,
        },
        ...(nodeEnv === 'production'
          ? /** @type {import('rolldown').OutputOptions[]} */ ([
              {
                file: path.join(
                  distPath,
                  `${packageName}.cjs.production.min.js`,
                ),
                format: 'cjs',
                esModule: true,
                sourcemap: true,
                exports: 'named',
                minify: true,
                codeSplitting: false,
              },
            ])
          : []),
      ],
    })
  const umdConfig =
    includeUMD &&
    defineConfig({
      input: path.join(srcPath, 'index.ts'),
      external: (id) => {
        const isExternal = external(id)
        if (isExternal && !jbrowseGlobals.includes(id)) {
          return false
        }
        return isExternal
      },
      resolve,
      treeshake: { propertyReadSideEffects: false },
      plugins: getPlugins('umd', jbrowseGlobals),
      output: [
        {
          file: path.join(distPath, `${packageName}.umd.development.js`),
          format: 'umd',
          name: umdName,
          esModule: true,
          sourcemap: true,
          exports: 'named',
          codeSplitting: false,
          globals: createGlobalMap(jbrowseGlobals, true),
        },
        ...(nodeEnv === 'production'
          ? /** @type {import('rolldown').OutputOptions[]} */ ([
              {
                file: path.join(
                  distPath,
                  `${packageName}.umd.production.min.js`,
                ),
                format: 'umd',
                name: umdName,
                esModule: true,
                sourcemap: true,
                exports: 'named',
                codeSplitting: false,
                globals: createGlobalMap(jbrowseGlobals, true),
                minify: true,
              },
            ])
          : []),
      ],
      watch: { clearScreen: false },
    })
  const esmBundleConfig =
    includeESMBundle &&
    defineConfig({
      input: path.join(srcPath, 'index.ts'),
      external: (id) => {
        const isExternal = external(id)
        if (isExternal && !jbrowseGlobals.includes(id)) {
          return false
        }
        return isExternal
      },
      resolve,
      treeshake: { propertyReadSideEffects: false, moduleSideEffects: false },
      plugins: getPlugins('esmBundle', jbrowseGlobals),
      output: [
        {
          file: path.join(distPath, `${packageName}.esm.js`),
          format: 'esm',
          esModule: true,
          sourcemap: true,
          exports: 'named',
          codeSplitting: false,
        },
      ],
      watch: { clearScreen: false },
    })
  const cjsConfig =
    includeCJS &&
    defineConfig({
      input: path.join(srcPath, 'index.ts'),
      external: (id) => {
        if (nodeBuiltins.includes(id)) {
          return true
        }
        const isExternal = external(id)
        if (isExternal && !jbrowseGlobals.includes(id)) {
          return false
        }
        return isExternal
      },
      resolve,
      treeshake: { propertyReadSideEffects: false, moduleSideEffects: false },
      plugins: getPlugins('cjs', jbrowseGlobals),
      output: [
        {
          file: path.join(distPath, `${packageName}.cjs.js`),
          format: 'cjs',
          esModule: true,
          sourcemap: true,
          exports: 'named',
          codeSplitting: false,
        },
      ],
      watch: { clearScreen: false },
    })
  /** @type {import('rolldown').RolldownOptions[]} */
  const configs = []
  for (const conf of [umdConfig, esmBundleConfig, npmConfig, cjsConfig]) {
    if (conf) {
      configs.push(conf)
    }
  }
  return defineConfig(configs)
}
