# Table of contents

<!-- toc -->

- [Table of contents](#table-of-contents)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g @apollo-annotation/cli
$ apollo COMMAND
running command...
$ apollo (--version)
@apollo-annotation/cli/0.3.5 linux-x64 node-v20.19.0
$ apollo --help [COMMAND]
USAGE
  $ apollo COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`apollo assembly add-from-fasta INPUT`](#apollo-assembly-add-from-fasta-input)
- [`apollo assembly add-from-gff INPUT-FILE`](#apollo-assembly-add-from-gff-input-file)
- [`apollo assembly check`](#apollo-assembly-check)
- [`apollo assembly delete`](#apollo-assembly-delete)
- [`apollo assembly get`](#apollo-assembly-get)
- [`apollo assembly sequence`](#apollo-assembly-sequence)
- [`apollo change get`](#apollo-change-get)
- [`apollo config [KEY] [VALUE]`](#apollo-config-key-value)
- [`apollo export gff3 ASSEMBLY`](#apollo-export-gff3-assembly)
- [`apollo feature add-child`](#apollo-feature-add-child)
- [`apollo feature check`](#apollo-feature-check)
- [`apollo feature copy`](#apollo-feature-copy)
- [`apollo feature delete`](#apollo-feature-delete)
- [`apollo feature edit`](#apollo-feature-edit)
- [`apollo feature edit-attribute`](#apollo-feature-edit-attribute)
- [`apollo feature edit-coords`](#apollo-feature-edit-coords)
- [`apollo feature edit-type`](#apollo-feature-edit-type)
- [`apollo feature get`](#apollo-feature-get)
- [`apollo feature get-id`](#apollo-feature-get-id)
- [`apollo feature import INPUT-FILE`](#apollo-feature-import-input-file)
- [`apollo feature search`](#apollo-feature-search)
- [`apollo file delete`](#apollo-file-delete)
- [`apollo file download`](#apollo-file-download)
- [`apollo file get`](#apollo-file-get)
- [`apollo file upload INPUT-FILE`](#apollo-file-upload-input-file)
- [`apollo help [COMMANDS]`](#apollo-help-commands)
- [`apollo jbrowse get-config`](#apollo-jbrowse-get-config)
- [`apollo jbrowse set-config INPUTFILE`](#apollo-jbrowse-set-config-inputfile)
- [`apollo login`](#apollo-login)
- [`apollo logout`](#apollo-logout)
- [`apollo refseq add-alias INPUT-FILE`](#apollo-refseq-add-alias-input-file)
- [`apollo refseq get`](#apollo-refseq-get)
- [`apollo status`](#apollo-status)
- [`apollo user get`](#apollo-user-get)

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
[src/commands/assembly/add-from-fasta.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/assembly/add-from-fasta.ts)_

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
[src/commands/assembly/add-from-gff.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/assembly/add-from-gff.ts)_

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
[src/commands/assembly/check.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/assembly/check.ts)_

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
[src/commands/assembly/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/assembly/delete.ts)_

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
[src/commands/assembly/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/assembly/get.ts)_

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
[src/commands/assembly/sequence.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/assembly/sequence.ts)_

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
[src/commands/change/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/change/get.ts)_

## `apollo config [KEY] [VALUE]`

Get or set apollo configuration options

```
USAGE
  $ apollo config [KEY] [VALUE] [--profile <value>] [---file <value>] [--get-config-file]

ARGUMENTS
  KEY    Name of configuration parameter
  VALUE  Parameter value

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --get-config-file      Return the path to the config file and exit (this file may not exist yet)
  --profile=<value>      Profile to create or edit

DESCRIPTION
  Get or set apollo configuration options

  Use this command to create or edit a user profile with credentials to access Apollo. Configuration options are:

  - address:
  Address and port e.g http://localhost:3999

  - accessType:
  How to access Apollo. accessType is typically one of: google, microsoft, guest, root. Allowed types depend on your
  Apollo setup

  - accessToken:
  Access token. Usually inserted by `apollo login`

  - rootPassword:
  Password for root account. Only set this for "root" access type

EXAMPLES
  Interactive setup:

    $ apollo config

  Setup with key/value pairs:

    $ apollo config --profile admin address http://localhost:3999

  Get current address for default profile:

    $ apollo config address
```

_See code:
[src/commands/config.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/config.ts)_

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
[src/commands/export/gff3.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/export/gff3.ts)_

## `apollo feature add-child`

Add a child feature (e.g. add an exon to an mRNA)

```
USAGE
  $ apollo feature add-child -s <value> -e <value> -t <value> [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -e, --end=<value>          (required) End coordinate of the child feature (1-based)
  -i, --feature-id=<value>   [default: -] Add a child to this feature ID; use - to read it from stdin
  -s, --start=<value>        (required) Start coordinate of the child feature (1-based)
  -t, --type=<value>         (required) Type of child feature
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add a child feature (e.g. add an exon to an mRNA)

  See the other commands under `apollo feature` to retrive the parent ID of interest and to populate the child feature
  with attributes.

EXAMPLES
  Add an exon at genomic coordinates 10..20 to this feature ID:

    $ apollo feature add-child -i 660...73f -t exon -s 10 -e 20
```

_See code:
[src/commands/feature/add-child.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/add-child.ts)_

## `apollo feature check`

Get check results

```
USAGE
  $ apollo feature check [--profile <value>] [--config-file <value>] [-i <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>       Get checks for this assembly
  -i, --feature-id=<value>...  Get checks for these feature identifiers
      --config-file=<value>    Use this config file (mostly for testing)
      --profile=<value>        Use credentials from this profile

DESCRIPTION
  Get check results

  Use this command to view which features fail checks along with the reason for failing.Use `apollo assembly check` for
  managing which checks should be applied to an assembly

EXAMPLES
  Get all check results in the database:

    $ apollo feature check

  Get check results for assembly hg19:

    $ apollo feature check -a hg19
```

_See code:
[src/commands/feature/check.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/check.ts)_

## `apollo feature copy`

Copy a feature to another location

```
USAGE
  $ apollo feature copy -r <value> -s <value> [--profile <value>] [--config-file <value>] [-i <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>     Name or ID of target assembly. Not required if refseq is unique in the database
  -i, --feature-id=<value>   [default: -] Feature ID to copy to; use - to read it from stdin
  -r, --refseq=<value>       (required) Name or ID of target reference sequence
  -s, --start=<value>        (required) Start position in target reference sequence
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Copy a feature to another location

  The feature may be copied to the same or to a different assembly. The destination reference sequence may be selected
  by name only if unique in the database or by name and assembly or by identifier.

EXAMPLES
  Copy this feature ID to chr1:100 in assembly hg38:

    $ apollo feature copy -i 6605826fbd0eee691f83e73f -r chr1 -s 100 -a hg38
```

_See code:
[src/commands/feature/copy.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/copy.ts)_

## `apollo feature delete`

Delete one or more features by ID

```
USAGE
  $ apollo feature delete [--profile <value>] [--config-file <value>] [-i <value>] [-f] [-n]

FLAGS
  -f, --force                  Ignore non-existing features
  -i, --feature-id=<value>...  [default: -] Feature IDs to delete
  -n, --dry-run                Only show what would be delete
      --config-file=<value>    Use this config file (mostly for testing)
      --profile=<value>        Use credentials from this profile

DESCRIPTION
  Delete one or more features by ID

  Note that deleting a child feature after deleting its parent will result in an error unless you set -f/--force.
```

_See code:
[src/commands/feature/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/delete.ts)_

## `apollo feature edit`

Edit features using an appropiate json input

```
USAGE
  $ apollo feature edit [--profile <value>] [--config-file <value>] [-j <value>]

FLAGS
  -j, --json-input=<value>   [default: -] Json string or json file or "-" to read json from stdin
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Edit features using an appropiate json input

  Edit a feature by submitting a json input with all the required attributes for Apollo to process it. This is a very
  low level command which most users probably do not need.

  Input may be a json string or a json file and it may be an array of changes. This is an example input for editing
  feature type:

  {
  "typeName": "TypeChange",
  "changedIds": [
  "6613f7d22c957525d631b1cc"
  ],
  "assembly": "6613f7d1360321540a11e5ed",
  "featureId": "6613f7d22c957525d631b1cc",
  "oldType": "BAC",
  "newType": "G_quartet"
  }

EXAMPLES
  Editing by passing a json to stdin:

    echo '{"typeName": ... "newType": "G_quartet"}' | apollo feature edit -j -
```

_See code:
[src/commands/feature/edit.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/edit.ts)_

## `apollo feature edit-attribute`

Add, edit, or view a feature attribute

```
USAGE
  $ apollo feature edit-attribute -a <value> [--profile <value>] [--config-file <value>] [-i <value>] [-v <value>] [-d]

FLAGS
  -a, --attribute=<value>    (required) Attribute key to add or edit
  -d, --delete               Delete this attribute
  -i, --feature-id=<value>   [default: -] Feature ID to edit or "-" to read it from stdin
  -v, --value=<value>...     New attribute value. Separated mutliple values by space to them as a list. If unset return
                             current value
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Add, edit, or view a feature attribute

  Be aware that there is no checking whether attributes names and values are valid. For example, you can create
  non-unique ID attributes or you can set gene ontology terms to non-existing terms

EXAMPLES
  Add attribute "domains" with a list of values:

    $ apollo feature edit-attribute -i 66...3f -a domains -v ABC PLD

  Print values in "domains" as json array:

    $ apollo feature edit-attribute -i 66...3f -a domains

  Delete attribute "domains"

    $ apollo feature edit-attribute -i 66...3f -a domains -d
```

_See code:
[src/commands/feature/edit-attribute.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/edit-attribute.ts)_

## `apollo feature edit-coords`

Edit feature start and/or end coordinates

```
USAGE
  $ apollo feature edit-coords [--profile <value>] [--config-file <value>] [-i <value>] [-s <value>] [-e <value>]

FLAGS
  -e, --end=<value>          New end coordinate (1-based)
  -i, --feature-id=<value>   [default: -] Feature ID to edit or "-" to read it from stdin
  -s, --start=<value>        New start coordinate (1-based)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Edit feature start and/or end coordinates

  If editing a child feature that new coordinates must be within the parent's coordinates.To get the identifier of the
  feature to edit consider using `apollo feature get` or `apollo feature search`

EXAMPLES
  Edit start and end:

    $ apollo feature edit-coords -i abc...xyz -s 10 -e 1000

  Edit end and leave start as it is:

    $ apollo feature edit-coords -i abc...xyz -e 2000
```

_See code:
[src/commands/feature/edit-coords.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/edit-coords.ts)_

## `apollo feature edit-type`

Edit or view feature type

```
USAGE
  $ apollo feature edit-type [--profile <value>] [--config-file <value>] [-i <value>] [-t <value>]

FLAGS
  -i, --feature-id=<value>   [default: -] Feature ID to edit or "-" to read it from stdin
  -t, --type=<value>         Assign feature to this type. If unset return the current type
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Edit or view feature type

  Feature type is column 3 in gff format.It must be a valid sequence ontology term although but the valifdity of the new
  term is not checked.
```

_See code:
[src/commands/feature/edit-type.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/edit-type.ts)_

## `apollo feature get`

Get features in assembly, reference sequence or genomic window

```
USAGE
  $ apollo feature get [--profile <value>] [--config-file <value>] [-a <value>] [-r <value>] [-s <value>] [-e
    <value>]

FLAGS
  -a, --assembly=<value>     Find input reference sequence in this assembly
  -e, --end=<value>          End coordinate
  -r, --refseq=<value>       Reference sequence. If unset, query all sequences
  -s, --start=<value>        [default: 1] Start coordinate (1-based)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get features in assembly, reference sequence or genomic window

EXAMPLES
  Get all features in myAssembly:

    $ apollo feature get -a myAssembly

  Get features intersecting chr1:1..1000. You can omit the assembly name if there are no other reference sequences
  named chr1:

    $ apollo feature get -a myAssembly -r chr1 -s 1 -e 1000
```

_See code:
[src/commands/feature/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/get.ts)_

## `apollo feature get-id`

Get features given their identifiers

```
USAGE
  $ apollo feature get-id [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --feature-id=<value>...  [default: -] Retrieves feature with these IDs. Use "-" to read IDs from stdin (one per
                               line)
      --config-file=<value>    Use this config file (mostly for testing)
      --profile=<value>        Use credentials from this profile

DESCRIPTION
  Get features given their identifiers

  Invalid identifiers or identifiers not found in the database will be silently ignored

EXAMPLES
  Get features for these identifiers:

    $ apollo feature get-id -i abc...zyz def...foo
```

_See code:
[src/commands/feature/get-id.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/get-id.ts)_

## `apollo feature import INPUT-FILE`

Import features from local gff file

```
USAGE
  $ apollo feature import INPUT-FILE -a <value> [--profile <value>] [--config-file <value>] [-d]

ARGUMENTS
  INPUT-FILE  Input gff file

FLAGS
  -a, --assembly=<value>     (required) Import into this assembly name or assembly ID
  -d, --delete-existing      Delete existing features before importing
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Import features from local gff file

  By default, features are added to the existing ones.

EXAMPLES
  Delete features in myAssembly and then import features.gff3:

    $ apollo feature import features.gff3 -d -a myAssembly
```

_See code:
[src/commands/feature/import.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/import.ts)_

## `apollo feature search`

Free text search for feature in one or more assemblies

```
USAGE
  $ apollo feature search -t <value> [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>...  Assembly names or IDs to search; use "-" to read it from stdin. If omitted search all
                             assemblies
  -t, --text=<value>         (required) Search for this text query
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Free text search for feature in one or more assemblies

  Return features matching a query string. This command searches only in:

  - Attribute *values* (not attribute names)
  - Source field (which in fact is stored as an attribute)
  - Feature type

  The search mode is:

  - Case insensitive
  - Match only full words, but not necessarily the full value
  - Common words are ignored. E.g. "the", "with"

  For example, given this feature:

  chr1 example SNP 10 30 0.987 . . "someKey=Fingerprint BAC with reads"

  Queries "bac" or "mRNA" return the feature. Instead these queries will NOT match:

  - "someKey"
  - "with"
  - "Finger"
  - "chr1"
  - "0.987"

EXAMPLES
  Search "bac" in these assemblies:

    $ apollo feature search -a mm9 mm10 -t bac
```

_See code:
[src/commands/feature/search.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/feature/search.ts)_

## `apollo file delete`

Delete files from the Apollo server

```
USAGE
  $ apollo file delete [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --file-id=<value>...   [default: -] IDs of the files to delete
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Delete files from the Apollo server

  Deleted files are printed to stdout. See also `apollo file get` to list the files on the server

EXAMPLES
  Delete file multiple files:

    $ apollo file delete -i 123...abc xyz...789
```

_See code:
[src/commands/file/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/delete.ts)_

## `apollo file download`

Download a file from the Apollo server

```
USAGE
  $ apollo file download [--profile <value>] [--config-file <value>] [-i <value>] [-o <value>]

FLAGS
  -i, --file-id=<value>      [default: -] ID of the file to download
  -o, --output=<value>       Write output to this file or "-" for stdout. Default to the name of the uploaded file.
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Download a file from the Apollo server

  See also `apollo file get` to list the files on the server

EXAMPLES
  Download file with id xyz

    $ apollo file download -i xyz -o genome.fa
```

_See code:
[src/commands/file/download.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/download.ts)_

## `apollo file get`

Get list of files uploaded to the Apollo server

```
USAGE
  $ apollo file get [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --file-id=<value>...   Get files matching this IDs
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get list of files uploaded to the Apollo server

  Print to stdout the list of files in json format

EXAMPLES
  Get files by id:

    $ apollo file get -i xyz abc
```

_See code:
[src/commands/file/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/get.ts)_

## `apollo file upload INPUT-FILE`

Upload a local file to the Apollo server

```
USAGE
  $ apollo file upload INPUT-FILE [--profile <value>] [--config-file <value>] [-t
    text/x-fasta|text/x-gff3|application/x-bgzip-fasta|text/x-fai|application/x-gzi] [-z | -d]

ARGUMENTS
  INPUT-FILE  Local file to upload

FLAGS
  -d, --decompressed         Override autodetection and instruct that input is decompressed
  -t, --type=<option>        Set file type or autodetected it if not set.
                             NB: There is no check for whether the file complies to this type
                             <options: text/x-fasta|text/x-gff3|application/x-bgzip-fasta|text/x-fai|application/x-gzi>
  -z, --gzip                 Override autodetection and instruct that input is gzip compressed
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Upload a local file to the Apollo server

  This command only uploads a file and returns the corresponding file id.
  To add an assembly based on this file or to upload & add an assembly in a single pass   see `apollo assembly
  add-from-fasta` and `add-from-gff`

EXAMPLES
  Upload local file, type auto-detected:

    $ apollo file upload genome.fa > file.json
```

_See code:
[src/commands/file/upload.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/file/upload.ts)_

## `apollo help [COMMANDS]`

Display help for apollo.

```
USAGE
  $ apollo help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for apollo.
```

_See code:
[@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.8/src/commands/help.ts)_

## `apollo jbrowse get-config`

Get JBrowse configuration from Apollo

```
USAGE
  $ apollo jbrowse get-config [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get JBrowse configuration from Apollo

  Print to stdout the JBrowse configuration from Apollo in JSON format

EXAMPLES
  Get JBrowse configuration:

    $ apollo jbrowse get-config > config.json
```

_See code:
[src/commands/jbrowse/get-config.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/jbrowse/get-config.ts)_

## `apollo jbrowse set-config INPUTFILE`

Set JBrowse configuration

```
USAGE
  $ apollo jbrowse set-config INPUTFILE [--profile <value>] [--config-file <value>]

ARGUMENTS
  INPUTFILE  JBrowse configuration file

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Set JBrowse configuration

  Set JBrowse configuration in Apollo collaboration server

EXAMPLES
  Add JBrowse configuration:

    $ apollo jbrowse set-config config.json
```

_See code:
[src/commands/jbrowse/set-config.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/jbrowse/set-config.ts)_

## `apollo login`

Login to Apollo

```
USAGE
  $ apollo login [--profile <value>] [--config-file <value>] [-a <value>] [-u <value>] [-p <value>] [-f]
    [--port <value>]

FLAGS
  -a, --address=<value>      Address of Apollo server
  -f, --force                Force re-authentication even if user is already logged in
  -p, --password=<value>     Password for <username>
  -u, --username=<value>     Username for root login
      --config-file=<value>  Use this config file (mostly for testing)
      --port=<value>         [default: 3000] Get token by listening to this port number (usually this is >= 1024 and <
                             65536)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Login to Apollo

  Use the provided credentials to obtain and save the token to access Apollo. Once the token for the given profile has
  been saved in the configuration file, users do not normally need to execute this command again unless the token has
  expired. To setup a new profile use "apollo config"

EXAMPLES
  The most basic and probably most typical usage is to login using the default profile in configuration file:

    $ apollo login

  Login with a different profile:

    $ apollo login --profile my-profile
```

_See code:
[src/commands/login.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/login.ts)_

## `apollo logout`

Logout of Apollo

```
USAGE
  $ apollo logout [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  Logout of Apollo

  Logout by removing the access token from the selected profile

EXAMPLES
  Logout default profile:

    $ apollo logout

  Logout selected profile

    $ apollo logout --profile my-profile
```

_See code:
[src/commands/logout.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/logout.ts)_

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
[src/commands/refseq/add-alias.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/refseq/add-alias.ts)_

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
[src/commands/refseq/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/refseq/get.ts)_

## `apollo status`

View authentication status

```
USAGE
  $ apollo status [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile

DESCRIPTION
  View authentication status

  This command returns "<profile>: Logged in" if the selected profile has an access token and "<profile>: Logged out"
  otherwise.Note that this command does not check the validity of the access token.
```

_See code:
[src/commands/status.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/status.ts)_

## `apollo user get`

Get list of users

```
USAGE
  $ apollo user get [--profile <value>] [--config-file <value>] [-u <value>] [-r <value>]

FLAGS
  -r, --role=<value>         Get users with this role
  -u, --username=<value>     Find this username
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get list of users

  If set, filters username and role must be both satisfied to return an entry

EXAMPLES
  By username:

    $ apollo user get -u Guest

  By role:

    $ apollo user get -r admin

  Use jq for more control:

    $ apollo user get | jq '.[] | select(.createdAt > "2024-03-18")'
```

_See code:
[src/commands/user/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.5/packages/apollo-cli/src/commands/user/get.ts)_

<!-- commandsstop -->
