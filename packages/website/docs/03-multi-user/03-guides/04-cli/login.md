# `apollo login`

Login to Apollo

- [`apollo login`](#apollo-login)

## `apollo login`

Login to Apollo

```
USAGE
  $ apollo login [--profile <value>] [--config-file <value>] [--timeout <value>] [-a <value>] [-u <value>]
    [-p <value>] [-f] [--browser]

FLAGS
  -a, --address=<value>      Address of Apollo server
  -f, --force                Force re-authentication even if user is already logged in
  -p, --password=<value>     Password for <username>
  -u, --username=<value>     Username for root login
      --[no-]browser         Try to open the login URL in a browser on this computer. Use --no-browser to only print the
                             URL.
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

DESCRIPTION
  Login to Apollo

  Use the provided credentials to obtain and save the token to access Apollo. Once the token for the given profile has
  been saved in the configuration file, users do not normally need to execute this command again unless the token has
  expired. To setup a new profile use "apollo config"

  For login types that sign in with a browser (e.g. Google, Microsoft, or another OpenID Connect provider), this command
  prints a URL and a code. Open the URL in a browser on any computer, check that the code matches, and sign in. This
  works even when running the command on a remote server, e.g. over SSH.

EXAMPLES
  The most basic and probably most typical usage is to login using the default profile in configuration file:

    $ apollo login

  Login with a different profile:

    $ apollo login --profile my-profile

  Print the login URL without trying to open a browser on this computer, e.g. when it's a remote server:

    $ apollo login --no-browser
```

_See code:
[src/commands/login.ts](https://github.com/GMOD/Apollo3/blob/v1.2.0/packages/apollo-cli/src/commands/login.ts)_
