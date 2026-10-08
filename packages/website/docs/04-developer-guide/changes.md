---
sidebar_position: 3
---

# Custom change types

Every edit in Apollo is a _change_: an object describing the edit, which is
validated, applied in the browser, sent to the server, applied to the database,
and broadcast to other users. A plugin can add its own kinds of change.

A change type has three parts:

1. **The change class**, shared by both halves of your plugin. It only describes
   the change: it has a `typeName`, can be serialized (`toJSON`) and
   reconstructed from that JSON (its constructor), and can create its inverse
   (`getInverse`), which is used to undo it.
2. **A client handler**, which applies the change to the features loaded in the
   browser.
3. **A server handler**, which applies the change to the database.

## The change class

Extend `FeatureChange` for changes to features (or `AssemblySpecificChange` or
`Change` for other changes), from `@apollo-annotation/common`.

```ts
import {
  FeatureChange,
  type SerializedFeatureChange,
} from '@apollo-annotation/common'

interface SerializedSetNotesChange extends SerializedFeatureChange {
  typeName: 'SetNotesChange'
  featureId: string
  oldNotes: string[]
  newNotes: string[]
}

export class SetNotesChange extends FeatureChange {
  typeName = 'SetNotesChange' as const
  featureId: string
  oldNotes: string[]
  newNotes: string[]

  constructor(json: SerializedSetNotesChange) {
    super(json)
    this.featureId = json.featureId
    this.oldNotes = json.oldNotes
    this.newNotes = json.newNotes
  }

  toJSON(): SerializedSetNotesChange {
    const { assembly, changedIds, featureId, newNotes, oldNotes, typeName } =
      this
    return { typeName, assembly, changedIds, featureId, oldNotes, newNotes }
  }

  getInverse() {
    return new SetNotesChange({
      ...this.toJSON(),
      oldNotes: this.newNotes,
      newNotes: this.oldNotes,
    })
  }
}
```

Use a `typeName` that's unlikely to clash with Apollo's or another plugin's,
since registering a second change type with the same name is an error.

## Registering on the client

```ts
pluginManager.addToExtensionPoint(
  'Apollo-RegisterChangeTypes',
  (changeTypes) => ({
    ...changeTypes,
    SetNotesChange: {
      changeType: SetNotesChange,
      handler(change: SetNotesChange, { dataStore }) {
        const feature = dataStore.getFeature(change.featureId)
        if (!feature) {
          throw new Error(`Could not find feature "${change.featureId}"`)
        }
        feature.setAttribute('note', change.newNotes)
      },
    },
  }),
)
```

The handler gets the client's data store, which can find loaded features
(`getFeature`), add and delete them (`addFeature`, `deleteFeature`), and load
features in a region (`loadFeatures`). Features are
[MobX-State-Tree](https://mobx-state-tree.js.org/) models; change them with
their actions (`setAttribute`, `setMin`, `addChild`, ...).

The client handler is optional: leave it out for changes that don't affect the
features loaded in the browser. The change class itself must always be
registered, so that the client can read changes of this type that other users
make.

To submit a change from your plugin's UI, use the `submitChange` function passed
to [context menu items and details widget components](client-plugins.md).

## Registering on the server

```ts
registrar.registerHook('Apollo-RegisterChangeTypes', (changeTypes) => ({
  ...changeTypes,
  SetNotesChange: {
    changeType: SetNotesChange,
    async handler(change: SetNotesChange, { connection, session }) {
      const topLevelFeature = await connection
        .model('Feature')
        .findOne({ allIds: change.featureId })
        .session(session)
        .exec()
      // ... find the feature, update its attributes ...
      topLevelFeature.markModified('children')
      await topLevelFeature.save()
    },
    requiredRole: 'user',
  },
}))
```

The server handler runs inside a MongoDB transaction: pass `session` to every
query, and throw to reject the change, which rolls back everything the handler
did. The handler also gets the `user` making the change and a `logger` (see
[what server code gets](server-plugins.md#what-server-code-gets)).

`requiredRole` is the role a user needs to submit the change: `'user'` (the
default) or `'admin'`.

Features are stored as one document per top-level feature, with child features
nested in `children`. Find the document containing a feature with
`{ allIds: featureId }`, change the feature inside it, mark the changed path as
modified, and save the top-level document.

## What happens when a change is submitted

1. In the browser: [change rules and client validations](validations.md) run;
   the client handler applies the change; client post-validations run (and undo
   it if they reject it).
2. On the server: the user's role is checked against `requiredRole`; change
   rules and server validations run; the server handler applies the change in a
   transaction; server post-validations run (and roll it back if they reject
   it).
3. The change is saved in the change log. Changes to an assembly
   (`AssemblySpecificChange`s, including `FeatureChange`s) are broadcast to
   other users, whose clients apply them with the client handler.

If the server rejects a change, the client undoes it with its inverse.
