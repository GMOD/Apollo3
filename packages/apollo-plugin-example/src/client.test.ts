/* eslint-disable @typescript-eslint/no-floating-promises */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { BuiltInGlyphs, Glyph } from '@apollo-annotation/common/client'
import PluginManager from '@jbrowse/core/PluginManager'

import { AddNoteDialog } from './components/AddNoteDialog.js'
import { NoteEditor } from './components/NoteEditor.js'
import { NoteViewer } from './components/NoteViewer.js'

import ApolloExamplePlugin from './index.js'

const DefaultEditor = () => null
const DefaultViewer = () => null

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

  it('reserves the "note" attribute key and gives it an editor and viewer', () => {
    const pluginManager = makePluginManager()
    assert.deepEqual(
      pluginManager.evaluateExtensionPoint('Apollo-ReservedAttributeKeys', {
        Custom: 'custom',
      }),
      { Custom: 'custom', Note: 'note' },
    )

    const editor = (key?: string) =>
      pluginManager.evaluateExtensionPoint(
        'Apollo-AttributeEditorComponent',
        DefaultEditor,
        { key },
      )
    const viewer = (key: string) =>
      pluginManager.evaluateExtensionPoint(
        'Apollo-AttributeViewerComponent',
        DefaultViewer,
        { key },
      )
    assert.equal(editor('note'), NoteEditor)
    assert.equal(editor('gene_name'), DefaultEditor)
    assert.equal(editor(), DefaultEditor)
    assert.equal(viewer('note'), NoteViewer)
    assert.equal(viewer('gene_name'), DefaultViewer)
  })

  it('adds menu items to add and clear notes that submit changes', () => {
    const pluginManager = makePluginManager()
    const submitted: unknown[] = []
    const dialogs: [unknown, { addNote: (note: string) => void }][] = []
    const props = (notes?: string[]) =>
      ({
        feature: {
          _id: 'feature1',
          assemblyId: 'assembly1',
          attributes: new Map(notes ? [['note', notes]] : []),
        },
        session: {
          queueDialog: (
            callback: (
              doneCallback: () => void,
            ) => [unknown, { addNote: (note: string) => void }],
          ) => {
            dialogs.push(
              callback(() => {
                // dialog closed
              }),
            )
          },
        },
        submitChange: (change: unknown) => {
          submitted.push(change)
          return Promise.resolve()
        },
      }) as never
    const menuItems = (notes?: string[]) =>
      pluginManager.evaluateExtensionPoint(
        'Apollo-FeatureContextMenuItems',
        [],
        props(notes),
      ) as { label: string; onClick: () => void }[]

    assert.deepEqual(
      menuItems().map((item) => item.label),
      ['Add note'],
    )
    const [addItem, clearItem] = menuItems(['a note'])
    assert.equal(addItem?.label, 'Add note')
    assert.equal(clearItem?.label, 'Clear notes')

    addItem.onClick()
    const [dialog] = dialogs
    assert.ok(dialog)
    assert.equal(dialog[0], AddNoteDialog)
    dialog[1].addNote('another note')
    assert.deepEqual((submitted[0] as { newNotes: string[] }).newNotes, [
      'a note',
      'another note',
    ])

    clearItem.onClick()
    assert.equal(submitted.length, 2)
    assert.deepEqual((submitted[1] as { newNotes: string[] }).newNotes, [])
  })
})
