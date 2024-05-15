# Table of contents

<!-- toc -->
* [oclif-hello-world](#oclif-hello-world)
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->

# Usage

<!-- usage -->
```sh-session
$ npm install -g @apollo-annotation/apollo-cli
$ apollo COMMAND
running command...
$ apollo (--version)
@apollo-annotation/apollo-cli/0.1.0 linux-x64 node-v18.19.0
$ apollo --help [COMMAND]
USAGE
  $ apollo COMMAND
...
```
<!-- usagestop -->

# Commands

<!-- commands -->
* [`apollo config [KEY] [VALUE]`](#apollo-config-key-value)
* [`apollo help [COMMANDS]`](#apollo-help-commands)
* [`apollo login`](#apollo-login)
* [`apollo logout`](#apollo-logout)
* [`apollo status`](#apollo-status)

## `apollo config [KEY] [VALUE]`

Get or set apollo configuration options

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
  Get or set apollo configuration options

  Use this command to create or edit a user profile with credentials to access
  Apollo. Configuration options are:

  - address:
  Address and port e.g http://localhost:3999

  - accessType:
  How to access Apollo. accessType is typically one of: google, microsoft, guest,
  root. Allowed types depend on your Apollo setup

  - accessToken:
  Access token. Usually inserted by `apollo login`

  - rootCredentials.username:
  Username of root account. Only set this for "root" access type

  - rootCredentials.password:
  Password for root account. Only set this for "root" access type

EXAMPLES
  Interactive setup:

    $ apollo config

  Setup with key/value pairs:

    $ apollo config --profile admin address http://localhost:3999

  Get current address for default profile:

    $ apollo config address
```

_See code: [src/commands/config.ts](https://github.com/GMOD/Apollo3/blob/v0.1.0/packages/apollo-cli/src/commands/config.ts)_

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

Login to Apollo

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
  Login to Apollo

  Use the provided credentials to obtain and save the token to access Apollo. Once
  the token for the given profile has been saved in the configuration file, users
  do not normally need to execute this command again unless the token has expired.
  To setup a new profile use "apollo config"

EXAMPLES
  The most basic and probably most typical usage is to login using the default
  profile in configuration file:

    $ apollo login

  Login with a different profile:

    $ apollo login --profile my-profile
```

_See code: [src/commands/login.ts](https://github.com/GMOD/Apollo3/blob/v0.1.0/packages/apollo-cli/src/commands/login.ts)_

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

_See code: [src/commands/logout.ts](https://github.com/GMOD/Apollo3/blob/v0.1.0/packages/apollo-cli/src/commands/logout.ts)_

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

  This command returns "<profile>: Logged in" if the selected profile has an
  access token and "<profile>: Logged out" otherwise. Note that this command does
  not check the validity of the access token.
```

_See code: [src/commands/status.ts](https://github.com/GMOD/Apollo3/blob/v0.1.0/packages/apollo-cli/src/commands/status.ts)_
<!-- commandsstop -->
