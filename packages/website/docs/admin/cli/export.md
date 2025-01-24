# `apollo export`

Commands to export data

- [`apollo export gff3 ASSEMBLY`](#apollo-export-gff3-assembly)

## `apollo export gff3 ASSEMBLY`

Export the annotation of an assembly to stdout as gff3

```
USAGE
  $ apollo export gff3 ASSEMBLY [--profile <value>] [--config-file <value>]

ARGUMENTS
  ASSEMBLY  Export features for this assembly name or id

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Export the annotation of an assembly to stdout as gff3

EXAMPLES
  Export annotation for myAssembly:

    $ apollo export gff3 myAssembly > out.gff3
```

_See code:
[src/commands/export/gff3.ts](https://github.com/GMOD/Apollo3/blob/v0.3.1/packages/apollo-cli/src/commands/export/gff3.ts)_
