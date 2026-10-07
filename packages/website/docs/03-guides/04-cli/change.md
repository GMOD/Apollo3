# `apollo change`

Commands to manage the change log

- [`apollo change get`](#apollo-change-get)
- [`apollo change submit [CHANGE-JSON]`](#apollo-change-submit-change-json)

## `apollo change get`

Get list of changes

```
USAGE
  $ apollo change get [--profile <value>] [--config-file <value>] [--timeout <value>] [-a <value>...]

FLAGS
  -a, --assembly=<value>...  Get changes only for these assembly names or IDs (but see description)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

DESCRIPTION
  Get list of changes

  Return the change log in json format. Note that when an assembly is deleted the link between common name and ID is
  lost (it can still be recovered by inspecting the change log but at present this task is left to the user). In such
  cases you need to use the assembly ID.
```

_See code:
[src/commands/change/get.ts](https://github.com/GMOD/Apollo3/blob/v1.1.3/packages/apollo-cli/src/commands/change/get.ts)_

## `apollo change submit [CHANGE-JSON]`

Submit one or more changes to Apollo

```
USAGE
  $ apollo change submit [CHANGE-JSON] [--profile <value>] [--config-file <value>] [--timeout <value>] [-F <value>]

ARGUMENTS
  [CHANGE-JSON]  Inline JSON describing the change(s) to submit. Can also be provided via stdin.

FLAGS
  -F, --change-json-file=<value>  File with JSON describing the change(s) to submit
      --config-file=<value>       Use this config file (mostly for testing)
      --profile=<value>           Use credentials from this profile
      --timeout=<value>           [default: 1h] Timeout for each request to the server

DESCRIPTION
  Submit one or more changes to Apollo

  Submit serialized change(s) directly to Apollo. Any change type known to the server can be submitted, including custom
  change types added by plugins. This is a low-level command; the change JSON must contain everything the change type
  requires (e.g. "typeName", "assembly", "changedIds").

  The change JSON can be passed via argument or stdin or use the --change-json-file option. To submit multiple changes,
  pass a JSON array; the changes are submitted one at a time in order.


EXAMPLES
  Submit a single change from inline JSON

    $ apollo change submit '{"typeName":"TypeChange","changedIds":["<featureId>"],"assembly":"<assemblyId>","feature \
      Id":"<featureId>","oldType":"BAC","newType":"G_quartet"}'

  Submit a change from stdin JSON

    echo '{"typeName":"MyPluginChange","assembly":"<assemblyId>", ...}' | apollo change submit

  Submit changes from a file

    $ apollo change submit --change-json-file changes.json
```

_See code:
[src/commands/change/submit.ts](https://github.com/GMOD/Apollo3/blob/v1.1.3/packages/apollo-cli/src/commands/change/submit.ts)_
