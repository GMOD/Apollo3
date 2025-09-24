# Themes and coloring

## Custom feature background

You can customise the background color of genes according to their type (_i.e._
according to the value in the 3rd column of a GFF file). Note that this color
customisation applies only to toplevel features (_e.g._ genes).

First retrieve the jbrowse configuration file:

```sh
apollo jbrowse get-config > config.json
```

Then add to the `ApolloPlugin` slot the key `backgroundColorForFeature`. The
value of this key is a string representing a
[jexl](https://www.npmjs.com/package/jexl) expression that assign a color to a
toplevel feature. For example, the `ApolloPlugin` slot may look like:

```json
"ApolloPlugin": {
    "hasRole": true,
    "ontologies": [...],
    "backgroundColorForFeature": "jexl: featureType == 'pseudogene' ? 'rgba(148, 203, 236, 0.6)' : featureType == 'ncRNA_gene' ? 'rgba(194, 106, 119, 0.6)': undefined"
}
```

Finally, set the new configuration file:

```sh
apollo jbrowse set-config config.json
rm config.json # optional
```

The expression should start with `jexl:` and contain valid jexl syntax. Note
that `if-else` and loop statements are not allowed and they should be replaced
with nested ternary operators as in the example above. The expression should be
written on a single line to comply with the JSON format.

The example above assigns custom colors to features of type _pseudogene_ and
_ncRNA_gene_ and leaves all the other feature types to as default color (since
the ternary operators end with `undefined`). The color string should be a valid
[CSS color](https:// developer.mozilla.org/en-US/docs/Web/CSS/color). Most likely,
you want to make the background color to be slightly transparent by setting, for
example, the forth argument of the `rgba` function (0.6 in the example).
