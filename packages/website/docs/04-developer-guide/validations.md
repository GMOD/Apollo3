---
sidebar_position: 4
---

# Validations

Validations decide whether a change is allowed. There are three kinds, depending
on what a validation needs to look at:

| Kind               | Package entry point                | Runs on           | Sees                                      |
| ------------------ | ---------------------------------- | ----------------- | ----------------------------------------- |
| `ChangeRule`       | `@apollo-annotation/common`        | Client and server | Only the change                           |
| `ClientValidation` | `@apollo-annotation/common/client` | Client            | The change and the features in the client |
| `ServerValidation` | `@apollo-annotation/common/server` | Server            | The change, the user and the database     |

Every kind returns an error message to reject a change, or nothing to allow it.
Validations run in the order they were registered, and stop at the first one
that rejects the change.

## Change rules

A change rule only looks at the change, so the same rule can run in both places.
Register it with both halves of your plugin: the client check gives users
immediate feedback, and the server check can't be bypassed by sending a change
to the server directly.

```ts
import { type Change, ChangeRule } from '@apollo-annotation/common'

export class NoteLengthRule extends ChangeRule {
  name = 'NoteLengthRule'

  validate(change: Change) {
    if (
      isSetNotesChange(change) &&
      change.newNotes.some((n) => n.length > 200)
    ) {
      return 'Notes can be at most 200 characters long'
    }
    return
  }
}
```

Change rules run before the change is applied, before any client or server
validation.

## Client validations

```ts
import { type Change } from '@apollo-annotation/common'
import {
  ClientValidation,
  type ClientValidationContext,
} from '@apollo-annotation/common/client'

export class NoNotesOnExonsValidation extends ClientValidation {
  name = 'NoNotesOnExonsValidation'

  preValidate(change: Change, { getFeature }: ClientValidationContext) {
    if (isSetNotesChange(change)) {
      const feature = getFeature(change.featureId)
      if (feature?.type === 'exon') {
        return 'Exons cannot have notes'
      }
    }
    return
  }
}
```

- `preValidate` runs before the change is applied in the client.
- `postValidate` runs after it's applied, before it's sent to the server. If it
  rejects the change, the change is undone in the client.

`getFeature` returns a plain snapshot of a feature loaded in the client.

Client validations only run in the browser, so a change sent to the server
another way (e.g. with the Apollo CLI) skips them. Use a change rule or server
validation for anything that must always hold.

## Server validations

```ts
import { type Change } from '@apollo-annotation/common'
import {
  type ServerPostValidationContext,
  ServerValidation,
} from '@apollo-annotation/common/server'

export class MaxNotesPerGeneValidation extends ServerValidation {
  name = 'MaxNotesPerGeneValidation'

  async postValidate(
    change: Change,
    { connection, session }: ServerPostValidationContext,
  ) {
    if (!isSetNotesChange(change)) {
      return
    }
    const gene = await connection
      .model('Feature')
      .findOne({ allIds: change.featureId })
      .session(session)
      .exec()
    // ... return an error message if the gene now has too many notes ...
    return
  }
}
```

- `preValidate` runs before the change is applied, and gets the `user`, the
  database `connection` and a `logger`.
- `postValidate` runs after the change is applied, in the same transaction, and
  also gets the transaction's `session`; pass it to queries to see the result of
  the change. If it rejects the change (or throws), the transaction is rolled
  back.

## Registering

On the client, with
[`contributeToExtensionPoint`](client-plugins.md#two-kinds-of-extension-point):

```ts
pluginManager.contributeToExtensionPoint('Apollo-RegisterValidations', () => [
  new NoteLengthRule(),
  new NoNotesOnExonsValidation(),
])
```

On the server:

```ts
registrar.registerHook('Apollo-RegisterValidations', (validations) => [
  ...validations,
  new NoteLengthRule(),
  new MaxNotesPerGeneValidation(),
])
```

## Validation is not authorization

Whether a user may submit a change at all depends on their role (see
`requiredRole` in [custom change types](changes.md#registering-on-the-server))
and, for changes to assemblies, on [assembly access](assembly-access.md). Both
are checked before any validation runs.
