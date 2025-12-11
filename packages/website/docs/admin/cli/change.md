# `apollo change`

Commands to manage the change log

- [`apollo change get`](#apollo-change-get)

## `apollo change get`

Get list of changes

```
USAGE
  $ apollo change get [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>...  Get changes only for these assembly names or IDs (but see description)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get list of changes

  Return the change log in json format. Note that when an assembly is deleted the link between common name and ID is
  lost (it can still be recovered by inspecting the change log but at present this task is left to the user). In such
  cases you need to use the assembly ID.
```

_See code:
[src/commands/change/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.10/packages/apollo-cli/src/commands/change/get.ts)_
