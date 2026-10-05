/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BuiltInGlyphs, Glyph } from '@apollo-annotation/common/client'
import PluginManager from '@jbrowse/core/PluginManager'

import ApolloExamplePlugin from './index.js'

function makePluginManager() {
  const pluginManager = new PluginManager([])
  new ApolloExamplePlugin().install(pluginManager)
  return pluginManager
}

describe('ApolloExamplePlugin', () => {
  it('contributes a change type, check and rule', () => {
    const pluginManager = makePluginManager()
    const changeTypes = pluginManager.evaluateExtensionPoint(
      'Apollo-RegisterChangeTypes',
      {},
    )
    assert.ok('ExampleNotesChange' in changeTypes)
    assert.equal(
      pluginManager.evaluateExtensionPoint('Apollo-RegisterChecks', []).length,
      1,
    )
    assert.equal(
      pluginManager.evaluateExtensionPoint('Apollo-RegisterValidations', [])
        .length,
      1,
    )
  })

  it('draws pseudogenes with children with the gene glyph', () => {
    const pluginManager = makePluginManager()
    const defaultGlyph = { name: 'default' } as unknown as Glyph
    const glyphs = { gene: { name: 'gene' } } as unknown as BuiltInGlyphs
    const getGlyph = (type: string, childCount: number) =>
      pluginManager.evaluateExtensionPoint('Apollo-GetGlyph', defaultGlyph, {
        feature: { type, children: { size: childCount } },
        display: {},
        glyphs,
      } as never)

    assert.equal(getGlyph('pseudogene', 1), glyphs.gene)
    assert.equal(getGlyph('pseudogene', 0), defaultGlyph)
    assert.equal(getGlyph('gene', 1), defaultGlyph)
  })

  it('adds a menu item to clear notes that submits a change', () => {
    const pluginManager = makePluginManager()
    const submitted: unknown[] = []
    const props = (notes?: string[]) =>
      ({
        feature: {
          _id: 'feature1',
          assemblyId: 'assembly1',
          attributes: new Map(notes ? [['note', notes]] : []),
        },
        submitChange: (change: unknown) => {
          submitted.push(change)
          return Promise.resolve()
        },
      }) as never

    assert.deepEqual(
      pluginManager.evaluateExtensionPoint(
        'Apollo-FeatureContextMenuItems',
        [],
        props(),
      ),
      [],
    )
    const [item] = pluginManager.evaluateExtensionPoint(
      'Apollo-FeatureContextMenuItems',
      [],
      props(['a note']),
    ) as { label: string; onClick: () => void }[]
    assert.ok(item)
    assert.equal(item.label, 'Clear notes')
    item.onClick()
    assert.equal(submitted.length, 1)
    assert.deepEqual((submitted[0] as { newNotes: string[] }).newNotes, [])
  })
})
