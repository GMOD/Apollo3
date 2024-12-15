# `apollo config`

Get or set apollo configuration options

- [`apollo config [KEY] [VALUE]`](#apollo-config-key-value)

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
[src/commands/config.ts](https://github.com/GMOD/Apollo3/blob/v0.2.1/packages/apollo-cli/src/commands/config.ts)_
