# `apollo logout`

Logout of Apollo

- [`apollo logout`](#apollo-logout)

## `apollo logout`

Logout of Apollo

```
USAGE
  $ apollo logout [--profile <value>] [--config-file <value>] [--timeout <value>]

FLAGS
  --config-file=<value>  Use this config file (mostly for testing)
  --profile=<value>      Use credentials from this profile
  --timeout=<value>      [default: 1h] Timeout for each request to the server

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
[src/commands/logout.ts](https://github.com/GMOD/Apollo3/blob/v1.1.1/packages/apollo-cli/src/commands/logout.ts)_
