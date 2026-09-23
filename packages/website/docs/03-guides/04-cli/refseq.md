# `apollo refseq`

Commands to manage reference sequences

- [`apollo refseq get`](#apollo-refseq-get)

## `apollo refseq get`

Get reference sequences

```
USAGE
  $ apollo refseq get [--profile <value>] [--config-file <value>] [--timeout <value>] [-a <value>...]

FLAGS
  -a, --assembly=<value>...  Get reference sequences for these assembly names or IDs; use - to read it from stdin
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

DESCRIPTION
  Get reference sequences

  Output the reference sequences in one or more assemblies in json format. This command returns the sequence
  characteristics (e.g., name, ID, etc), not the DNA sequences. Use `assembly sequence` for that.

EXAMPLES
  All sequences in the database:

    $ apollo refseq get

  Only sequences for these assemblies:

    $ apollo refseq get -a mm9 mm10
```

_See code:
[src/commands/refseq/get.ts](https://github.com/GMOD/Apollo3/blob/v1.1.2/packages/apollo-cli/src/commands/refseq/get.ts)_
