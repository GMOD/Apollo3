# `apollo feature`

Commands to manage features

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
[src/commands/feature/add-child.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/add-child.ts)_

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
[src/commands/feature/check.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/check.ts)_

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
[src/commands/feature/copy.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/copy.ts)_

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
[src/commands/feature/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/delete.ts)_

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
[src/commands/feature/edit.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/edit.ts)_

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
[src/commands/feature/edit-attribute.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/edit-attribute.ts)_

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
[src/commands/feature/edit-coords.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/edit-coords.ts)_

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
[src/commands/feature/edit-type.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/edit-type.ts)_

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
[src/commands/feature/get.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/get.ts)_

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
[src/commands/feature/get-id.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/get-id.ts)_

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
[src/commands/feature/import.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/import.ts)_

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
[src/commands/feature/search.ts](https://github.com/GMOD/Apollo3/blob/v0.3.0/packages/apollo-cli/src/commands/feature/search.ts)_
