# `apollo refseq`

Commands to manage reference sequences

- [`apollo refseq add-alias INPUT-FILE`](#apollo-refseq-add-alias-input-file)
- [`apollo refseq get`](#apollo-refseq-get)

## `apollo refseq add-alias INPUT-FILE`

Add reference name aliases from a file

```
USAGE
  $ apollo refseq add-alias INPUT-FILE -a <value> [--profile <value>] [--config-file <value>]

ARGUMENTS
  INPUT-FILE  Input refname alias file

FLAGS
  -a, --assembly=<value>     (required) Name for this assembly.
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add reference name aliases from a file

  Reference name aliasing is a process to make chromosomes that are named slightly differently but which refer to the
  same thing render properly. This command reads a file with reference name aliases and adds them to the database.

EXAMPLES
  Add reference name aliases:

    $ apollo refseq add-alias alias.txt -a myAssembly
```

_See code:
[src/commands/refseq/add-alias.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/refseq/add-alias.ts)_

## `apollo refseq get`

Get reference sequences

```
USAGE
  $ apollo refseq get [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>...  Get reference sequences for these assembly names or IDs; use - to read it from stdin
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

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
[src/commands/refseq/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/refseq/get.ts)_
