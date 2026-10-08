import type {} from '@apollo-annotation/common/client'
import Plugin from '@jbrowse/core/Plugin'
import type PluginManager from '@jbrowse/core/PluginManager'

import { AddNoteDialog } from './components/AddNoteDialog.js'
import { NoteEditor } from './components/NoteEditor.js'
import { NoteViewer } from './components/NoteViewer.js'
import { ExampleNoteLengthRule } from './shared/ExampleNoteLengthRule.js'
import { ExampleNotesChange } from './shared/ExampleNotesChange.js'
import { ExampleShortFeatureCheck } from './shared/ExampleShortFeatureCheck.js'

/**
 * The client (JBrowse) half of the example plugin. Importing anything from
 * `@apollo-annotation/common/client` (even just its types, as above) adds
 * Apollo's extension points to JBrowse's types, so the callbacks below are
 * type-checked.
 */
export default class ApolloExamplePlugin extends Plugin {
  name = 'ApolloExamplePlugin'

  install(pluginManager: PluginManager) {
    // A change type: the same class as on the server, with a client handler
    // that applies it to the features loaded in the browser
    pluginManager.addToExtensionPoint(
      'Apollo-RegisterChangeTypes',
      (changeTypes) => ({
        ...changeTypes,
        ExampleNotesChange: {
          changeType: ExampleNotesChange,
          handler(change: ExampleNotesChange, { dataStore }) {
            const feature = dataStore.getFeature(change.featureId)
            if (!feature) {
              throw new Error(`Could not find feature "${change.featureId}"`)
            }
            const attributes = new Map(
              [...feature.attributes.entries()].map(([key, value]) => [
                key,
                [...value],
              ]),
            )
            if (change.newNotes.length > 0) {
              attributes.set('note', change.newNotes)
            } else {
              attributes.delete('note')
            }
            feature.setAttributes(attributes)
          },
        },
      }),
    )

    // Checks and change rules are environment-independent, so the same ones
    // are registered on the client and the server
    pluginManager.contributeToExtensionPoint(
      'Apollo-RegisterChecks',
      () => new ExampleShortFeatureCheck(),
    )
    pluginManager.contributeToExtensionPoint(
      'Apollo-RegisterValidations',
      () => new ExampleNoteLengthRule(),
    )

    // Draw pseudogenes that have children the way genes are drawn
    pluginManager.addToExtensionPoint(
      'Apollo-GetGlyph',
      (glyph, { feature, glyphs }) =>
        feature.type === 'pseudogene' && feature.children?.size
          ? glyphs.gene
          : glyph,
    )

    // Offer "note" when adding an attribute, and edit and show it with our
    // own components. Other attributes are passed through unchanged.
    pluginManager.addToExtensionPoint(
      'Apollo-ReservedAttributeKeys',
      (reservedKeys) => ({ ...reservedKeys, Note: 'note' }),
    )
    pluginManager.addToExtensionPoint(
      'Apollo-AttributeEditorComponent',
      (Editor, { key }) => (key === 'note' ? NoteEditor : Editor),
    )
    pluginManager.addToExtensionPoint(
      'Apollo-AttributeViewerComponent',
      (Viewer, { key }) => (key === 'note' ? NoteViewer : Viewer),
    )

    // Context menu items that submit a change, one of them from a dialog
    pluginManager.contributeToExtensionPoint(
      'Apollo-FeatureContextMenuItems',
      ({ feature, session, submitChange }) => {
        const notes = [...(feature.attributes.get('note') ?? [])]
        const setNotes = (newNotes: string[]) =>
          submitChange(
            new ExampleNotesChange({
              typeName: 'ExampleNotesChange',
              assembly: feature.assemblyId,
              changedIds: [feature._id],
              featureId: feature._id,
              oldNotes: notes,
              newNotes,
            }),
          )
        const addNote = {
          label: 'Add note',
          onClick: () => {
            session.queueDialog((doneCallback) => [
              AddNoteDialog,
              {
                handleClose: doneCallback,
                addNote: (note: string) => {
                  void setNotes([...notes, note])
                },
              },
            ])
          },
        }
        if (notes.length === 0) {
          return addNote
        }
        return [
          addNote,
          {
            label: 'Clear notes',
            onClick: () => {
              void setNotes([])
            },
          },
        ]
      },
    )
  }
}
