---
sidebar_position: 5
---

# Checks

Checks look for problems in annotations, such as a coding sequence without a
stop codon. Their results are shown as warnings on features. A plugin can add
its own checks.

A check gets a plain snapshot of a top-level feature (with its children) and a
function to get the reference sequence, and returns a result for each problem it
finds. Since it doesn't depend on where it runs, the same check class is used by
both halves of a plugin.

```ts
import {
  type AnnotationFeatureSnapshot,
  Check,
  type CheckResultSnapshot,
} from '@apollo-annotation/common'

export class ShortFeatureCheck extends Check {
  name = 'ShortFeatureCheck'
  version = 1
  causes = ['ShortFeature']
  isDefault = false

  async checkFeature(
    feature: AnnotationFeatureSnapshot,
    getSequence: (start: number, end: number) => Promise<string>,
  ): Promise<CheckResultSnapshot[]> {
    const results: CheckResultSnapshot[] = []
    if (feature.max - feature.min < 3) {
      results.push({
        _id: makeObjectId(), // a new 24-character hex ID
        name: this.name,
        cause: 'ShortFeature',
        ids: [feature._id],
        refSeq: feature.refSeq,
        start: feature.min,
        end: feature.max,
        message: 'Feature is shorter than 3 bases',
      })
    }
    // ... check feature.children too ...
    return results
  }
}
```

- `name` identifies the check, and must be unique.
- `version`: increase it when you change what the check finds, so that features
  already checked are checked again.
- `causes` lists the kinds of problem the check reports (each result's `cause`
  is one of them).
- `isDefault`: whether the check is turned on for new assemblies. Admins can
  turn checks on or off for each assembly with "Apollo > Admin > Manage Checks".
- Each result's `ids` are the features it applies to, and `start` and `end` the
  region it's about.

## Registering

On the client, with
[`contributeToExtensionPoint`](client-plugins.md#two-kinds-of-extension-point):

```ts
pluginManager.contributeToExtensionPoint(
  'Apollo-RegisterChecks',
  () => new ShortFeatureCheck(),
)
```

On the server:

```ts
registrar.registerHook('Apollo-RegisterChecks', (checks) => [
  ...checks,
  new ShortFeatureCheck(),
])
```

## Where checks run

- With the collaboration server, checks run on the server, for the checks turned
  on for the feature's assembly, when a feature changes or is fetched after the
  check was updated. Results are stored and sent to clients.
- When annotating local files in the browser (without a server), every
  registered check runs in the browser after each change.

Register a check with both halves of your plugin so it works in both setups.
