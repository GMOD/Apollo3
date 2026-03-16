# `apollo login`

Login to Apollo

- [`apollo login`](#apollo-login)

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
[src/commands/login.ts](https://github.com/GMOD/Apollo3/blob/v0.3.11/packages/apollo-cli/src/commands/login.ts)_
