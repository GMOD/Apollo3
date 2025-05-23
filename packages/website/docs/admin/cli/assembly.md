# `apollo assembly`

Commands to manage assemblies

- [`apollo assembly add-from-fasta INPUT`](#apollo-assembly-add-from-fasta-input)
- [`apollo assembly add-from-gff INPUT-FILE`](#apollo-assembly-add-from-gff-input-file)
- [`apollo assembly check`](#apollo-assembly-check)
- [`apollo assembly delete`](#apollo-assembly-delete)
- [`apollo assembly get`](#apollo-assembly-get)
- [`apollo assembly sequence`](#apollo-assembly-sequence)

## `apollo assembly add-from-fasta INPUT`

Add a new assembly from fasta input

```
USAGE
  $ apollo assembly add-from-fasta INPUT [--profile <value>] [--config-file <value>] [-a <value>] [-f] [-e] [--fai <value>]
    [--gzi <value>] [-z | -d]

ARGUMENTS
  INPUT  Input fasta file, local or remote, or id of a previously uploaded file. For local or remote files, it is
         assumed the file is bgzip'd with `bgzip` and indexed with `samtools faidx`. The indexes are assumed to be at
         <my.fasta.gz>.fai and <my.fasta.gz>.gzi unless the options --fai and --gzi are provided. A local file can be
         uncompressed if the flag -e/--editable is set (but see below about using -e)

FLAGS
  -a, --assembly=<value>     Name for this assembly. Use the file name if omitted
  -d, --decompressed         For local file input: Override autodetection and instruct that input is decompressed
  -e, --editable             Instead of using indexed fasta lookup, the sequence is loaded into the Apollo database and
                             is editable. Use with caution, as editing the sequence often has unintended side effects.
  -f, --force                Delete existing assembly, if it exists
  -z, --gzip                 For local file input: Override autodetection and instruct that input is gzip compressed
      --config-file=<value>  Use this config file (mostly for testing)
      --fai=<value>          Fasta index of the (not-editable) fasta file
      --gzi=<value>          Gzi index of the (not-editable) fasta file
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add a new assembly from fasta input

  Add new assembly. The input fasta may be:
  * A local file bgzip'd and indexed. It can be uncompressed if the -e/--editable is set (but see description of -e)
  * An external fasta file bgzip'd and indexed
  * The id of a file previously uploaded to Apollo

EXAMPLES
  From local file assuming indexes genome.gz.fai and genome.gz.gzi are present:

    $ apollo assembly add-from-fasta genome.fa.gz -a myAssembly

  Local file with editable sequence does not require compression and indexing:

    $ apollo assembly add-from-fasta genome.fa -a myAssembly

  From external source assuming there are also indexes https://.../genome.fa.gz.fai and https://.../genome.fa.gz.gzi:

    $ apollo assembly add-from-fasta https://.../genome.fa.gz -a myAssembly
```

_See code:
[src/commands/assembly/add-from-fasta.ts](https://github.com/GMOD/Apollo3/blob/v0.3.6/packages/apollo-cli/src/commands/assembly/add-from-fasta.ts)_

## `apollo assembly add-from-gff INPUT-FILE`

Add new assembly from gff or gft file

```
USAGE
  $ apollo assembly add-from-gff INPUT-FILE [--profile <value>] [--config-file <value>] [-a <value>] [-o] [-f]

ARGUMENTS
  INPUT-FILE  Input gff file

FLAGS
  -a, --assembly=<value>     Name for this assembly. Use the file name if omitted
  -f, --force                Delete existing assembly, if it exists
  -o, --omit-features        Do not import features, only upload the sequences
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add new assembly from gff or gft file

  The gff file is expected to contain sequences as per gff specifications. Features are also imported by default.

EXAMPLES
  Import sequences and features:

    $ apollo assembly add-from-gff genome.gff -a myAssembly

  Import sequences only:

    $ apollo assembly add-from-gff genome.gff -a myAssembly -o
```

_See code:
[src/commands/assembly/add-from-gff.ts](https://github.com/GMOD/Apollo3/blob/v0.3.6/packages/apollo-cli/src/commands/assembly/add-from-gff.ts)_

## `apollo assembly check`

Add, view, or delete checks to assembly

```
USAGE
  $ apollo assembly check [--profile <value>] [--config-file <value>] [-a <value>] [-c <value>] [-d]

FLAGS
  -a, --assembly=<value>     Manage checks in this assembly
  -c, --check=<value>...     Add these check names or IDs. If unset, print the checks set for assembly
  -d, --delete               Delete (instead of adding) checks
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

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
[src/commands/assembly/check.ts](https://github.com/GMOD/Apollo3/blob/v0.3.6/packages/apollo-cli/src/commands/assembly/check.ts)_

## `apollo assembly delete`

Delete assemblies

```
USAGE
  $ apollo assembly delete -a <value> [--profile <value>] [--config-file <value>] [-v]

FLAGS
  -a, --assembly=<value>...  (required) Assembly names or IDs to delete
  -v, --verbose              Print to stdout the array of assemblies deleted
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Delete assemblies

  Assemblies to delete may be names or IDs

EXAMPLES
  Delete multiple assemblies using name or ID:

    $ apollo assembly delete -a mouse 6605826fbd0eee691f83e73f
```

_See code:
[src/commands/assembly/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.3.6/packages/apollo-cli/src/commands/assembly/delete.ts)_

## `apollo assembly get`

Get available assemblies

```
USAGE
  $ apollo assembly get [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>...  Get assemblies in this list of names or IDs
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get available assemblies

  Print to stdout the list of assemblies in json format
```

_See code:
[src/commands/assembly/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.6/packages/apollo-cli/src/commands/assembly/get.ts)_

## `apollo assembly sequence`

Get reference sequence in fasta format

```
USAGE
  $ apollo assembly sequence [--profile <value>] [--config-file <value>] [-a <value>] [-r <value>] [-s <value>] [-e
    <value>]

FLAGS
  -a, --assembly=<value>     Find input reference sequence in this assembly
  -e, --end=<value>          End coordinate
  -r, --refseq=<value>       Reference sequence. If unset, get all sequences
  -s, --start=<value>        [default: 1] Start coordinate (1-based)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

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
[src/commands/assembly/sequence.ts](https://github.com/GMOD/Apollo3/blob/v0.3.6/packages/apollo-cli/src/commands/assembly/sequence.ts)_
