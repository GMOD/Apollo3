# Table of contents

<!-- toc -->

- [Table of contents](#table-of-contents)
- [Usage](#usage)
- [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->

```sh-session
$ npm install -g apollo-cli
$ apollo COMMAND
running command...
$ apollo (--version)
apollo-cli/0.0.0 darwin-x64 node-v18.19.0
$ apollo --help [COMMAND]
USAGE
  $ apollo COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`apollo assemblies add-fasta`](#apollo-assemblies-add-fasta)
- [`apollo assemblies add-gff`](#apollo-assemblies-add-gff)
- [`apollo assemblies delete`](#apollo-assemblies-delete)
- [`apollo assemblies get`](#apollo-assemblies-get)
- [`apollo changes get`](#apollo-changes-get)
- [`apollo config [KEY] [VALUE]`](#apollo-config-key-value)
- [`apollo features add-child`](#apollo-features-add-child)
- [`apollo features delete`](#apollo-features-delete)
- [`apollo features edit`](#apollo-features-edit)
- [`apollo features edit-attribute`](#apollo-features-edit-attribute)
- [`apollo features edit-coords`](#apollo-features-edit-coords)
- [`apollo features edit-type`](#apollo-features-edit-type)
- [`apollo features get`](#apollo-features-get)
- [`apollo features import`](#apollo-features-import)
- [`apollo features search`](#apollo-features-search)
- [`apollo help [COMMANDS]`](#apollo-help-commands)
- [`apollo login`](#apollo-login)
- [`apollo logout`](#apollo-logout)
- [`apollo refSeqs get`](#apollo-refseqs-get)
- [`apollo status`](#apollo-status)
- [`apollo users get`](#apollo-users-get)

## `apollo assemblies add-fasta`

Add assembly sequences from local fasta file or external source

```
USAGE
  $ apollo assemblies add-fasta -i <value> -n <value> [--profile <value>] [--config-file <value>] [-x <value>]

FLAGS
  -i, --input-file=<value>     (required) Input fasta file
  -n, --assembly-name=<value>  (required) Name for this assembly
  -x, --index=<value>          URL of the index. Ignored if input is a local file
      --config-file=<value>    Use this config file (mostly for testing)
      --profile=<value>        [default: default] Use credentials from this profile

DESCRIPTION
  Add assembly sequences from local fasta file or external source
```

_See code:
[src/commands/assemblies/add-fasta.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assemblies/add-fasta.ts)_

## `apollo assemblies add-gff`

Add assembly sequences from gff or gft file

```
USAGE
  $ apollo assemblies add-gff -i <value> -n <value> [--profile <value>] [--config-file <value>] [-o]

FLAGS
  -i, --input-file=<value>     (required) Input gff or gtf file
  -n, --assembly-name=<value>  (required) Name for this assembly
  -o, --omit-features          Do not import features, only upload the sequences
      --config-file=<value>    Use this config file (mostly for testing)
      --profile=<value>        [default: default] Use credentials from this profile

DESCRIPTION
  Add assembly sequences from gff or gft file
```

_See code:
[src/commands/assemblies/add-gff.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assemblies/add-gff.ts)_

## `apollo assemblies delete`

Delete assemblies

```
USAGE
  $ apollo assemblies delete -n <value> [--profile <value>] [--config-file <value>]

FLAGS
  -n, --names=<value>...     (required) Assembly names or IDs to delete
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Delete assemblies
```

_See code:
[src/commands/assemblies/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assemblies/delete.ts)_

## `apollo assemblies get`

Get available assemblies

```
USAGE
  $ apollo assemblies get [--profile <value>] [--config-file <value>] [-n <value>]

FLAGS
  -n, --names=<value>...     Get assemblies in this list of names
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get available assemblies
```

_See code:
[src/commands/assemblies/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assemblies/get.ts)_

## `apollo changes get`

Get changes

```
USAGE
  $ apollo changes get [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get changes
```

_See code:
[src/commands/changes/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/changes/get.ts)_

## `apollo config [KEY] [VALUE]`

Get or set Apollo configuration options

```
USAGE
  $ apollo config [KEY] [VALUE] [--profile <value>] [---file <value>]

ARGUMENTS
  KEY    Name of configuration parameter
  VALUE  Parameter value

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Profile to create or edit

DESCRIPTION
  Get or set Apollo configuration options
```

_See code:
[src/commands/config.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/config.ts)_

## `apollo features add-child`

Add a child feature

```
USAGE
  $ apollo features add-child -s <value> -e <value> -t <value> [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -e, --end=<value>          (required) End coordinate of the child feature (1-based)
  -i, --feature-id=<value>   [default: -] Feature ID to add child to; use - to read it from stdin
  -s, --start=<value>        (required) Start coordinate of the child feature (1-based)
  -t, --type=<value>         (required) Feature ID to edit or - to read it from stdin
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Add a child feature
```

_See code:
[src/commands/features/add-child.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/add-child.ts)_

## `apollo features delete`

Free text search for feature in one or more assemblies

```
USAGE
  $ apollo features delete [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --feature-id=<value>   [default: -] Feature ID to delete
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Free text search for feature in one or more assemblies
```

_See code:
[src/commands/features/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/delete.ts)_

## `apollo features edit`

Edit features using an appropiate json input

```
USAGE
  $ apollo features edit [--profile <value>] [--config-file <value>] [-j <value>]

FLAGS
  -j, --json-input=<value>   [default: -] Json string or json file or "-" to read json from stdin
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Edit features using an appropiate json input
```

_See code:
[src/commands/features/edit.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/edit.ts)_

## `apollo features edit-attribute`

Add or edit a feature attribute

```
USAGE
  $ apollo features edit-attribute -a <value> [--profile <value>] [--config-file <value>] [-i <value>] [-v <value>]

FLAGS
  -a, --attribute=<value>    (required) Attribute key to add or edit
  -i, --feature-id=<value>   [default: -] Feature ID to edit or "-" to read it from stdin
  -v, --value=<value>...     New attribute value or return current value if unset
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Add or edit a feature attribute
```

_See code:
[src/commands/features/edit-attribute.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/edit-attribute.ts)_

## `apollo features edit-coords`

Edit feature coordinates (start and/or end)

```
USAGE
  $ apollo features edit-coords [--profile <value>] [--config-file <value>] [-i <value>] [-s <value>] [-e <value>]

FLAGS
  -e, --end=<value>          New end coordinate (1-based)
  -i, --feature-id=<value>   [default: -] Feature ID to edit or "-" to read it from stdin
  -s, --start=<value>        New start coordinate (1-based)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Edit feature coordinates (start and/or end)
```

_See code:
[src/commands/features/edit-coords.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/edit-coords.ts)_

## `apollo features edit-type`

Edit type of feature

```
USAGE
  $ apollo features edit-type -t <value> [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --feature-id=<value>   [default: -] Feature ID to edit or "-" to read it from stdin
  -t, --type=<value>         (required) Assign this type
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Edit type of feature
```

_See code:
[src/commands/features/edit-type.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/edit-type.ts)_

## `apollo features get`

Get features in a genomic window

```
USAGE
  $ apollo features get -r <value> [--profile <value>] [--config-file <value>] [-s <value>] [-e <value>]

FLAGS
  -e, --end=<value>          End coordinate
  -r, --refSeq=<value>       (required) Reference sequence
  -s, --start=<value>        [default: 1] Start coordinate (1-based)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get features in a genomic window
```

_See code:
[src/commands/features/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/get.ts)_

## `apollo features import`

Import features from local gff file

```
USAGE
  $ apollo features import -i <value> -a <value> [--profile <value>] [--config-file <value>] [-d]

FLAGS
  -a, --assembly=<value>     (required) Import into this assembly name or assembly ID
  -d, --delete-existing      Delete existing features before importing
  -i, --input-file=<value>   (required) Input gff or gtf file
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Import features from local gff file
```

_See code:
[src/commands/features/import.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/import.ts)_

## `apollo features search`

Free text search for feature in one or more assemblies

```
USAGE
  $ apollo features search -t <value> [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assemblies=<value>...  [default: -] Assembly names or IDs to search; use "-" to read it from stdin
  -t, --text=<value>           (required) Search for this text query
      --config-file=<value>    Use this config file (mostly for testing)
      --profile=<value>        [default: default] Use credentials from this profile

DESCRIPTION
  Free text search for feature in one or more assemblies
```

_See code:
[src/commands/features/search.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/search.ts)_

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

## `apollo login`

Log in to Apollo

```
USAGE
  $ apollo login [--profile <value>] [--config-file <value>] [-a <value>] [-u <value>] [-p <value>] [-f]

FLAGS
  -a, --address=<value>      Address of Apollo server
  -f, --force                Force re-authentication even if user is already logged in
  -p, --password=<value>     Password for <username>
  -u, --username=<value>     Username for root login
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Log in to Apollo
```

_See code:
[src/commands/login.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/login.ts)_

## `apollo logout`

Log out of Apollo

```
USAGE
  $ apollo logout [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Log out of Apollo
```

_See code:
[src/commands/logout.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/logout.ts)_

## `apollo refSeqs get`

Get available reference sequences

```
USAGE
  $ apollo refSeqs get [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get available reference sequences
```

_See code:
[src/commands/refSeqs/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/refSeqs/get.ts)_

## `apollo status`

View authentication status

```
USAGE
  $ apollo status [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  View authentication status
```

_See code:
[src/commands/status.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/status.ts)_

## `apollo users get`

Get users

```
USAGE
  $ apollo users get [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get users
```

_See code:
[src/commands/users/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/users/get.ts)_

<!-- commandsstop -->
