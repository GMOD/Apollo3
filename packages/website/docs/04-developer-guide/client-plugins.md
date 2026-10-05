---
sidebar_position: 2
---

# Client plugins

A client plugin is a
[JBrowse plugin](https://jbrowse.org/jb2/docs/developer_guides/creating_plugins/)
that uses the extension points of Apollo's JBrowse plugin. Add it to JBrowse's
`config.json` like any other plugin. Apollo's own plugin is always loaded first,
so other plugins can rely on it being there.

```ts
import type {} from '@apollo-annotation/common/client'
import Plugin from '@jbrowse/core/Plugin'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class MyPlugin extends Plugin {
  name = 'MyPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addToExtensionPoint(
      'Apollo-GetGlyph',
      (glyph, { feature, glyphs }) =>
        feature.type === 'pseudogene' ? glyphs.gene : glyph,
    )
  }
}
```

Importing anything from `@apollo-annotation/common/client` (even just its types,
as above) adds Apollo's extension points to JBrowse's types, so
`addToExtensionPoint` and `contributeToExtensionPoint` check your callbacks
against what Apollo passes them.

## Two kinds of extension point

- Most extension points pass a value through each plugin's callback, which
  returns a new value. Register with `addToExtensionPoint(name, callback)`,
  where the callback gets the value so far and the extension point's props.
- Extension points that collect a list (`Apollo-RegisterChecks`,
  `Apollo-RegisterValidations` and `Apollo-FeatureContextMenuItems`) are
  registered with `contributeToExtensionPoint(name, callback)`. The callback
  gets the props and returns only your own entries (one, several, or nothing),
  so one plugin can't drop another's.

## Extension points

### Registering things with Apollo

These are evaluated once, when Apollo's plugin is configured (after every
plugin's `install` has run).

| Extension point              | Register with                | Value                                 |
| ---------------------------- | ---------------------------- | ------------------------------------- |
| `Apollo-RegisterChangeTypes` | `addToExtensionPoint`        | `Record<string, ClientChangeType>`    |
| `Apollo-RegisterChecks`      | `contributeToExtensionPoint` | `Check`s                              |
| `Apollo-RegisterValidations` | `contributeToExtensionPoint` | `ChangeRule`s and `ClientValidation`s |

See [Custom change types](changes.md), [Checks](checks.md) and
[Validations](validations.md). Register change types, checks and change rules
through these extension points rather than importing Apollo's registries: your
plugin's bundle has its own copy of `@apollo-annotation/common`, so the
registries it would import aren't the ones Apollo uses.

### Drawing features: `Apollo-GetGlyph`

Chooses the glyph that draws a feature in the linear annotation display. The
value is the glyph Apollo would use. The props are the `feature`, the `display`
and `glyphs`, Apollo's built-in glyphs (`box`, `gene`, `transcript`, `exon`,
`cds` and `genericChild`), so a plugin can draw other feature types with one of
them or wrap one. The `Glyph` interface is exported from
`@apollo-annotation/common/client`.

### Feature context menus: `Apollo-FeatureContextMenuItems`

Adds items to a feature's context menu in the linear and six-frame annotation
displays and the table editor. Register with `contributeToExtensionPoint`; the
callback gets the `feature`, the `session`, where the menu is shown
(`location`), and a `submitChange` function, and returns the items to add.

```ts
pluginManager.contributeToExtensionPoint(
  'Apollo-FeatureContextMenuItems',
  ({ feature, submitChange }) => ({
    label: 'Mark as reviewed',
    onClick: () => {
      void submitChange(makeReviewedChange(feature))
    },
  }),
)
```

`submitChange` validates a change, applies it in the client and sends it to the
server, the same way Apollo's own menus do.

### Feature details widgets

Plugins can add components to the feature and transcript details widgets. Each
slot is an extension point whose value is a component (rendering nothing by
default); return your own component, rendering the previous one too if another
plugin may also use the slot. The component gets the `feature`, the `session`
and `submitChange`.

- Feature details: `Apollo-FeatureDetailsCustomComponent-` followed by
  `AfterBasicInformation`, `InsideAttributes`, `AfterAttributes`,
  `InsideSequence`, `AfterSequence`, `InsideRelatedFeatures` or
  `AfterRelatedFeatures`
- Transcript details: `Apollo-TranscriptDetailsCustomComponent-` followed by
  `InsideSummary`, `AfterSummary`, `InsideLocation`, `AfterLocation`,
  `InsideAttributes`, `AfterAttributes`, `InsideSequence` or `AfterSequence`

### Attributes

| Extension point                   | Value                                                                     | Props     |
| --------------------------------- | ------------------------------------------------------------------------- | --------- |
| `Apollo-AttributeEditorComponent` | The component used to edit an attribute's values (`AttributeEditorProps`) | `{ key }` |
| `Apollo-AttributeViewerComponent` | The component used to show an attribute's values (`AttributeViewerProps`) | `{ key }` |
| `Apollo-ReservedAttributeKeys`    | The attribute keys offered when adding an attribute, as label → key       | none      |

`key` is the attribute being edited or shown (undefined for a new attribute in
the editor), so a plugin can provide a custom editor for one attribute and pass
others through. For `Apollo-ReservedAttributeKeys`, return a new object rather
than changing the one you're given.

## Other customization

- Top-level menus: add items to the `Apollo` menu with JBrowse's
  `rootModel.appendToMenu('Apollo', ...)` in your plugin's `configure` method.
- Feature colors: the `geneBackgroundColor` setting in Apollo's plugin
  configuration accepts a JEXL expression.
