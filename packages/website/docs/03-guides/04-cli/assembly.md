# `apollo assembly`

Commands to manage assemblies

- [`apollo assembly check`](#apollo-assembly-check)
- [`apollo assembly get`](#apollo-assembly-get)
- [`apollo assembly sequence`](#apollo-assembly-sequence)

## `apollo assembly check`

Add, view, or delete checks to assembly

```
USAGE
  $ apollo assembly check [--profile <value>] [--config-file <value>] [--timeout <value>] [-a <value>] [-c
    <value>...] [-d]

FLAGS
  -a, --assembly=<value>     Manage checks in this assembly
  -c, --check=<value>...     Add these check names or IDs. If unset, print the checks set for assembly
  -d, --delete               Delete (instead of adding) checks
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

DESCRIPTION
  Add, view, or delete checks to assembly

  Manage checks, i.e. the rules ensuring features in an assembly are plausible. This command only sets the checks to
  apply, to retrieve features flagged by these checks use `apollo feature check`.

EXAMPLES
  View available check types:

    $ apollo assembly check

  View checks set for assembly hg19:

    $ apollo assembly check -a hg19

  Add checks to assembly:

    $ apollo assembly check -a hg19 -c CDSCheck

  Delete checks from assembly:

    $ apollo assembly check -a hg19 -c CDSCheck --delete
```

_See code:
[src/commands/assembly/check.ts](https://github.com/GMOD/Apollo3/blob/v1.1.2/packages/apollo-cli/src/commands/assembly/check.ts)_

## `apollo assembly get`

Get available assemblies

```
USAGE
  $ apollo assembly get [--profile <value>] [--config-file <value>] [--timeout <value>] [-a <value>...]

FLAGS
  -a, --assembly=<value>...  Get assemblies in this list of names or IDs
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

DESCRIPTION
  Get available assemblies

  Print to stdout the list of assemblies in json format
```

_See code:
[src/commands/assembly/get.ts](https://github.com/GMOD/Apollo3/blob/v1.1.2/packages/apollo-cli/src/commands/assembly/get.ts)_

## `apollo assembly sequence`

Get reference sequence in fasta format

```
USAGE
  $ apollo assembly sequence [--profile <value>] [--config-file <value>] [--timeout <value>] [-a <value>] [-r <value>]
    [-s <value>] [-e <value>]

FLAGS
  -a, --assembly=<value>     Find input reference sequence in this assembly
  -e, --end=<value>          End coordinate
  -r, --refseq=<value>       Reference sequence. If unset, get all sequences
  -s, --start=<value>        [default: 1] Start coordinate (1-based)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

DESCRIPTION
  Get reference sequence in fasta format

  Return the reference sequence for a given assembly and coordinates

EXAMPLES
  Get all sequences in myAssembly:

    $ apollo assembly sequence -a myAssembly

  Get sequence in coordinates chr1:1..1000:

    $ apollo assembly sequence -a myAssembly -r chr1 -s 1 -e 1000
```

_See code:
[src/commands/assembly/sequence.ts](https://github.com/GMOD/Apollo3/blob/v1.1.2/packages/apollo-cli/src/commands/assembly/sequence.ts)_
