# `apollo export`

Commands to export data

- [`apollo export gff3 ASSEMBLY`](#apollo-export-gff3-assembly)

## `apollo export gff3 ASSEMBLY`

Export the annotations for an assembly to stdout as gff3

```
USAGE
  $ apollo export gff3 ASSEMBLY [--profile <value>] [--config-file <value>] [--include-fasta]

ARGUMENTS
  ASSEMBLY  Export annotations for this assembly name or id

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --include-fasta        Include fasta sequence in output
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Export the annotations for an assembly to stdout as gff3

EXAMPLES
  Export annotations for myAssembly:

    $ apollo export gff3 myAssembly > out.gff3
```

_See code:
[src/commands/export/gff3.ts](https://github.com/GMOD/Apollo3/blob/v0.3.3/packages/apollo-cli/src/commands/export/gff3.ts)_
