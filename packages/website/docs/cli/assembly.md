# `apollo assembly`

Commands to handle assemblies

- [`apollo assembly add-fasta`](#apollo-assembly-add-fasta)
- [`apollo assembly add-file`](#apollo-assembly-add-file)
- [`apollo assembly add-gff`](#apollo-assembly-add-gff)
- [`apollo assembly check`](#apollo-assembly-check)
- [`apollo assembly delete`](#apollo-assembly-delete)
- [`apollo assembly get`](#apollo-assembly-get)
- [`apollo assembly sequence`](#apollo-assembly-sequence)

## `apollo assembly add-fasta`

Add new assembly from local or external fasta file

```
USAGE
  $ apollo assembly add-fasta -i <value> [--profile <value>] [--config-file <value>] [-a <value>] [-x <value>] [-f] [-n]

FLAGS
  -a, --assembly=<value>     Name for this assembly. Use the file name if omitted
  -f, --force                Delete existing assembly, if it exists
  -i, --input-file=<value>   (required) Input fasta file
  -n, --no-db                Do not load the fasta sequence into the Apollo database. This option assumes the
                             fasta file is bgzip'd with `bgzip` and indexed with `samtools faidx`. Indexes
                             should be named <my.fasta.gz>.gzi and <my.fasta.gz>.fai
  -x, --index=<value>        URL of the index. Required if input is an external source
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add new assembly from local or external fasta file

EXAMPLES
  From local file:

    $ apollo assembly add-fasta -i genome.fa -a myAssembly

  From external source we also need the URL of the index:

    $ apollo assembly add-fasta -i https://.../genome.fa -x https://.../genome.fa.fai -a myAssembly
```

_See code:
[src/commands/assembly/add-fasta.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/assembly/add-fasta.ts)_

## `apollo assembly add-file`

Add new assembly from an uploaded file

```
USAGE
  $ apollo assembly add-file [--profile <value>] [--config-file <value>] [-i <value>] [-a <value>] [-f]

FLAGS
  -a, --assembly=<value>     Name for this assembly. If omitted use the file id
  -f, --force                Delete existing assembly, if it exists
  -i, --file-id=<value>      [default: -] ID of file to upload
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add new assembly from an uploaded file

  Use the file id of a previously uploaded file to add a new assembly.

  For uploading a new file see `apollo file upload`

  For getting the file id of an uploaded file see `apollo file get`

  For uploading & adding in a single pass see `apollo assembly add-*`

EXAMPLES
  Use file id xyz to add assembly "myAssembly":

    $ apollo assembly add-file -i xyz -a myAssembly
```

_See code:
[src/commands/assembly/add-file.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/assembly/add-file.ts)_

## `apollo assembly add-gff`

Add new assembly from gff or gft file

```
USAGE
  $ apollo assembly add-gff -i <value> [--profile <value>] [--config-file <value>] [-a <value>] [-o] [-f]

FLAGS
  -a, --assembly=<value>     Name for this assembly. Use the file name if omitted
  -f, --force                Delete existing assembly, if it exists
  -i, --input-file=<value>   (required) Input gff file
  -o, --omit-features        Do not import features, only upload the sequences
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add new assembly from gff or gft file

  The gff file is expected to contain sequences as per gff specifications.
  Features are also imported by default.

EXAMPLES
  Import sequences and features:

    $ apollo assembly add-gff -i genome.gff -a myAssembly

  Import sequences only:

    $ apollo assembly add-gff -i genome.gff -a myAssembly -o
```

_See code:
[src/commands/assembly/add-gff.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/assembly/add-gff.ts)_

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

  Manage checks, i.e. the rules ensuring features in an assembly are plausible.
  This command only sets the checks to apply, to retrieve features flagged by
  these checks use `apollo feature check`.

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
[src/commands/assembly/check.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/assembly/check.ts)_

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
[src/commands/assembly/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/assembly/delete.ts)_

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
[src/commands/assembly/get.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/assembly/get.ts)_

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
[src/commands/assembly/sequence.ts](https://github.com/GMOD/Apollo3/blob/v0.1.19/packages/apollo-cli/src/commands/assembly/sequence.ts)_
