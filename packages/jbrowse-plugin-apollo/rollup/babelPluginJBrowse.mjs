/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// Based on https://github.com/jaredpalmer/tsdx/blob/8b91c747c2235ed4fbf853a39fb6800cbf70b2b3/src/babelPluginTsdx.ts

import { createRequire } from 'node:module'

import { createConfigItem } from '@babel/core'
import { createBabelInputPluginFactory } from '@rollup/plugin-babel'
import merge from 'lodash.merge'

const require = createRequire(import.meta.url)

// replace lodash with lodash-es, but not lodash/fp
const replacements = [{ original: 'lodash(?!/fp)', replacement: 'lodash-es' }]

function mergeConfigItems(type, ...configItemsToMerge) {
  const mergedItems = []

  for (const configItemToMerge of configItemsToMerge) {
    for (const item of configItemToMerge) {
      const itemToMergeWithIndex = mergedItems.findIndex(
        (mergedItem) => mergedItem.file.resolved === item.file.resolved,
      )

      if (itemToMergeWithIndex === -1) {
        mergedItems.push(item)
        continue
      }

      mergedItems[itemToMergeWithIndex] = createConfigItem(
        [
          mergedItems[itemToMergeWithIndex].file.resolved,
          merge(mergedItems[itemToMergeWithIndex].options, item.options),
        ],
        { type },
      )
    }
  }

  return mergedItems
}

function createConfigItems(type, items) {
  return items.map(({ name, ...options }) => {
    return createConfigItem([require.resolve(name), options], { type })
  })
}

export const babelPluginJBrowse = createBabelInputPluginFactory(() => ({
  // Passed the plugin options.
  options({ custom: customOptions, ...pluginOptions }) {
    return {
      // Pull out any custom options that the plugin might have.
      customOptions,

      // Pass the options back with the two custom options removed.
      pluginOptions,
    }
  },
  config(config, { customOptions }) {
    const defaultPlugins = createConfigItems(
      'plugin',
      [
        // {
        //   name: '@babel/plugin-transform-react-jsx',
        //   pragma: customOptions.jsx || 'h',
        //   pragmaFrag: customOptions.jsxFragment || 'Fragment',
        // },
        { name: 'babel-plugin-macros' },
        { name: 'babel-plugin-annotate-pure-calls' },
        { name: 'babel-plugin-dev-expression' },
        customOptions.format !== 'cjs' && {
          name: 'babel-plugin-transform-rename-import',
          replacements,
        },
        {
          name: 'babel-plugin-polyfill-regenerator',
          // don't pollute global env as this is being used in a library
          method: 'usage-pure',
        },
        { name: '@babel/plugin-proposal-class-properties' },
      ].filter(Boolean),
    )

    const babelOptions = config.options || {}
    babelOptions.presets = babelOptions.presets || []

    const presetEnvIdx = babelOptions.presets.findIndex((preset) =>
      preset.file.request.includes('@babel/preset-env'),
    )

    // if they use preset-env, merge their options with ours
    if (presetEnvIdx === -1) {
      // if no preset-env, add it & merge with their presets
      const defaultPresets = createConfigItems('preset', [
        {
          name: '@babel/preset-env',
          targets: customOptions.targets,
          modules: false,
        },
      ])

      babelOptions.presets = mergeConfigItems(
        'preset',
        defaultPresets,
        babelOptions.presets,
      )
    } else {
      const presetEnv = babelOptions.presets[presetEnvIdx]
      babelOptions.presets[presetEnvIdx] = createConfigItem(
        [
          presetEnv.file.resolved,
          merge({ targets: customOptions.targets }, presetEnv.options, {
            modules: false,
          }),
        ],
        { type: `preset` },
      )
    }

    // Merge babelrc & our plugins together
    babelOptions.plugins = mergeConfigItems(
      'plugin',
      defaultPlugins,
      babelOptions.plugins || [],
    )

    return babelOptions
  },
}))
