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
apollo-cli/0.0.0 linux-x64 node-v18.19.0
$ apollo --help [COMMAND]
USAGE
  $ apollo COMMAND
...
```

<!-- usagestop -->

# Commands

<!-- commands -->

- [`apollo assembly add-fasta`](#apollo-assembly-add-fasta)
- [`apollo assembly add-gff`](#apollo-assembly-add-gff)
- [`apollo assembly delete`](#apollo-assembly-delete)
- [`apollo assembly get`](#apollo-assembly-get)
- [`apollo change get`](#apollo-change-get)
- [`apollo config [KEY] [VALUE]`](#apollo-config-key-value)
- [`apollo feature add-child`](#apollo-feature-add-child)
- [`apollo feature copy`](#apollo-feature-copy)
- [`apollo feature delete`](#apollo-feature-delete)
- [`apollo feature edit`](#apollo-feature-edit)
- [`apollo feature edit-attribute`](#apollo-feature-edit-attribute)
- [`apollo feature edit-coords`](#apollo-feature-edit-coords)
- [`apollo feature edit-type`](#apollo-feature-edit-type)
- [`apollo feature get`](#apollo-feature-get)
- [`apollo feature import`](#apollo-feature-import)
- [`apollo feature search`](#apollo-feature-search)
- [`apollo help [COMMANDS]`](#apollo-help-commands)
- [`apollo login`](#apollo-login)
- [`apollo logout`](#apollo-logout)
- [`apollo refseq get`](#apollo-refseq-get)
- [`apollo status`](#apollo-status)
- [`apollo user get`](#apollo-user-get)

## `apollo assembly add-fasta`

Add assembly sequences from local fasta file or external source

```
USAGE
  $ apollo assembly add-fasta -i <value> -a <value> [--profile <value>] [--config-file <value>] [-x <value>] [-f]

FLAGS
  -a, --assembly=<value>     (required) Name for this assembly
  -f, --force                Delete existing assembly, if it exists
  -i, --input-file=<value>   (required) Input fasta file
  -x, --index=<value>        URL of the index. Ignored if input is a local file
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Add assembly sequences from local fasta file or external source
```

_See code:
[src/commands/assembly/add-fasta.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assembly/add-fasta.ts)_

## `apollo assembly add-gff`

Add assembly sequences from gff or gft file

```
USAGE
  $ apollo assembly add-gff -i <value> -a <value> [--profile <value>] [--config-file <value>] [-o] [-f]

FLAGS
  -a, --assembly=<value>     (required) Name for this assembly
  -f, --force                Delete existing assembly, if it exists
  -i, --input-file=<value>   (required) Input gff or gtf file
  -o, --omit-features        Do not import features, only upload the sequences
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Add assembly sequences from gff or gft file
```

_See code:
[src/commands/assembly/add-gff.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assembly/add-gff.ts)_

## `apollo assembly delete`

Delete assemblies

```
USAGE
  $ apollo assembly delete -a <value> [--profile <value>] [--config-file <value>]

FLAGS
  -a, --assembly=<value>...  (required) Assembly names or IDs to delete
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Delete assemblies
```

_See code:
[src/commands/assembly/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assembly/delete.ts)_

## `apollo assembly get`

Get available assemblies

```
USAGE
  $ apollo assembly get [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>...  Get assemblies in this list of names or IDs
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get available assemblies
```

_See code:
[src/commands/assembly/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assembly/get.ts)_

## `apollo change get`

Get changes

```
USAGE
  $ apollo change get [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get changes
```

_See code:
[src/commands/change/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/change/get.ts)_

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

## `apollo feature add-child`

Add a child feature

```
USAGE
  $ apollo feature add-child -s <value> -e <value> -t <value> [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -e, --end=<value>          (required) End coordinate of the child feature (1-based)
  -i, --feature-id=<value>   [default: -] Feature ID to add child to; use - to read it from stdin
  -s, --start=<value>        (required) Start coordinate of the child feature (1-based)
  -t, --type=<value>         (required) Type of child feature
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Add a child feature
```

_See code:
[src/commands/feature/add-child.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/add-child.ts)_

## `apollo feature copy`

Copy feature

```
USAGE
  $ apollo feature copy -r <value> -s <value> [--profile <value>] [--config-file <value>] [-i <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>     Name or ID of target assembly. Not required if refseq is unique in the database
  -i, --feature-id=<value>   [default: -] Feature ID to copy to; use - to read it from stdin
  -r, --refseq=<value>       (required) Name or ID of target reference sequence
  -s, --start=<value>        (required) Start position in target reference sequence
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Copy feature
```

_See code:
[src/commands/feature/copy.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/copy.ts)_

## `apollo feature delete`

Delete a feature

```
USAGE
  $ apollo feature delete [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --feature-id=<value>   [default: -] Feature ID to delete
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Delete a feature
```

_See code:
[src/commands/feature/delete.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/delete.ts)_

## `apollo feature edit`

Edit features using an appropiate json input

```
USAGE
  $ apollo feature edit [--profile <value>] [--config-file <value>] [-j <value>]

FLAGS
  -j, --json-input=<value>   [default: -] Json string or json file or "-" to read json from stdin
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Edit features using an appropiate json input
```

_See code:
[src/commands/feature/edit.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/edit.ts)_

## `apollo feature edit-attribute`

Add or edit a feature attribute

```
USAGE
  $ apollo feature edit-attribute -a <value> [--profile <value>] [--config-file <value>] [-i <value>] [-v <value>]

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
[src/commands/feature/edit-attribute.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/edit-attribute.ts)_

## `apollo feature edit-coords`

Edit feature coordinates (start and/or end)

```
USAGE
  $ apollo feature edit-coords [--profile <value>] [--config-file <value>] [-i <value>] [-s <value>] [-e <value>]

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
[src/commands/feature/edit-coords.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/edit-coords.ts)_

## `apollo feature edit-type`

Edit type of feature

```
USAGE
  $ apollo feature edit-type -t <value> [--profile <value>] [--config-file <value>] [-i <value>]

FLAGS
  -i, --feature-id=<value>   [default: -] Feature ID to edit or "-" to read it from stdin
  -t, --type=<value>         (required) Assign this type
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Edit type of feature
```

_See code:
[src/commands/feature/edit-type.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/edit-type.ts)_

## `apollo feature get`

Get features in a genomic window

```
USAGE
  $ apollo feature get [--profile <value>] [--config-file <value>] [-r <value>] [-a <value>] [-s <value>] [-e
    <value>]

FLAGS
  -a, --assembly=<value>     Find input reference sequence in this assembly
  -e, --end=<value>          End coordinate
  -r, --refseq=<value>       Reference sequence. If unset, query all sequences
  -s, --start=<value>        [default: 1] Start coordinate (1-based)
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get features in a genomic window
```

_See code:
[src/commands/feature/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/get.ts)_

## `apollo feature import`

Import features from local gff file

```
USAGE
  $ apollo feature import -i <value> -a <value> [--profile <value>] [--config-file <value>] [-d]

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
[src/commands/feature/import.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/import.ts)_

## `apollo feature search`

Free text search for feature in one or more assemblies

```
USAGE
  $ apollo feature search -t <value> [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assemblies=<value>...  [default: -] Assembly names or IDs to search; use "-" to read it from stdin
  -t, --text=<value>           (required) Search for this text query
      --config-file=<value>    Use this config file (mostly for testing)
      --profile=<value>        [default: default] Use credentials from this profile

DESCRIPTION
  Free text search for feature in one or more assemblies
```

_See code:
[src/commands/feature/search.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/feature/search.ts)_

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

## `apollo refseq get`

Get available reference sequences

```
USAGE
  $ apollo refseq get [--profile <value>] [--config-file <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>...  Get reference sequences for these assembly names or IDs; use - to read it from stdin
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get available reference sequences
```

_See code:
[src/commands/refseq/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/refseq/get.ts)_

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

## `apollo user get`

Get users

```
USAGE
  $ apollo user get [--profile <value>] [--config-file <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      [default: default] Use credentials from this profile

DESCRIPTION
  Get users
```

_See code:
[src/commands/user/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/user/get.ts)_

<!-- commandsstop -->
