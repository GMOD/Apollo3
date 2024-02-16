# Table of contents
<!-- toc -->
* [Table of contents](#table-of-contents)
* [Usage](#usage)
* [Commands](#commands)
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
* [`apollo assemblies get`](#apollo-assemblies-get)
* [`apollo changes get`](#apollo-changes-get)
* [`apollo config [KEY] [VALUE]`](#apollo-config-key-value)
* [`apollo features get`](#apollo-features-get)
* [`apollo help [COMMANDS]`](#apollo-help-commands)
* [`apollo login`](#apollo-login)
* [`apollo logout`](#apollo-logout)
* [`apollo refSeqs get`](#apollo-refseqs-get)
* [`apollo status`](#apollo-status)
* [`apollo users get`](#apollo-users-get)

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

_See code: [src/commands/assemblies/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/assemblies/get.ts)_

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

_See code: [src/commands/changes/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/changes/get.ts)_

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

_See code: [src/commands/config.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/config.ts)_

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

_See code: [src/commands/features/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/features/get.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.8/src/commands/help.ts)_

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

_See code: [src/commands/login.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/login.ts)_

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

_See code: [src/commands/logout.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/logout.ts)_

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

_See code: [src/commands/refSeqs/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/refSeqs/get.ts)_

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

_See code: [src/commands/status.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/status.ts)_

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

_See code: [src/commands/users/get.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/users/get.ts)_
<!-- commandsstop -->
