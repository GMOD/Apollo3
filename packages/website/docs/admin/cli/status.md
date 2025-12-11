# `apollo status`

View authentication status

- [`apollo status`](#apollo-status)

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
[src/commands/status.ts](https://github.com/GMOD/Apollo3/blob/v0.3.10/packages/apollo-cli/src/commands/status.ts)_
