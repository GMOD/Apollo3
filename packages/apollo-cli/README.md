# oclif-hello-world

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![CircleCI](https://circleci.com/gh/oclif/hello-world/tree/main.svg?style=shield)](https://circleci.com/gh/oclif/hello-world/tree/main)
[![GitHub license](https://img.shields.io/github/license/oclif/hello-world)](https://github.com/oclif/hello-world/blob/main/LICENSE)

<!-- toc -->

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

- [`apollo config [KEY] [VALUE]`](#apollo-config-key-value)
- [`apollo help [COMMANDS]`](#apollo-help-commands)
- [`apollo login`](#apollo-login)
- [`apollo logout`](#apollo-logout)
- [`apollo status`](#apollo-status)

## `apollo config [KEY] [VALUE]`

Get or set Apollo configuration options

```
USAGE
  $ apollo config [KEY] [VALUE] [-p <value>]

ARGUMENTS
  KEY    Name of configuration parameter
  VALUE  Parameter value

FLAGS
  -p, --profile=<value>  [default: default] Set or get configuration for this profile

DESCRIPTION
  Get or set Apollo configuration options
```

_See code:
[src/commands/config.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/config.ts)_

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
  $ apollo login [--profile <value>] [-a <value>] [-u <value>] [-p <value>] [-f]

FLAGS
  -a, --address=<value>   Address of Apollo server
  -f, --force             Force re-authentication even if user is already logged in
  -p, --password=<value>  Password for <username>
  -u, --username=<value>  Username for root login
      --profile=<value>   [default: default] Use credentials from this profile

DESCRIPTION
  Log in to Apollo
```

_See code:
[src/commands/login.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/login.ts)_

## `apollo logout`

Log out of Keycloak

```
USAGE
  $ apollo logout

DESCRIPTION
  Log out of Keycloak
```

_See code:
[src/commands/logout.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/logout.ts)_

## `apollo status`

View authentication status

```
USAGE
  $ apollo status

DESCRIPTION
  View authentication status
```

_See code:
[src/commands/status.ts](https://github.com/GMOD/Apollo3/blob/v0.0.0/packages/apollo-cli/src/commands/status.ts)_

<!-- commandsstop -->
