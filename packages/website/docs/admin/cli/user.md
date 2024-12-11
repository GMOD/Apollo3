# `apollo user`

Commands to manage users

- [`apollo user get`](#apollo-user-get)

## `apollo user get`

Get list of users

```
USAGE
  $ apollo user get [--profile <value>] [--config-file <value>] [-u <value>] [-r <value>]

FLAGS
  -r, --role=<value>         Get users with this role
  -u, --username=<value>     Find this username
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Get list of users

  If set, filters username and role must be both satisfied to return an entry

EXAMPLES
  By username:

    $ apollo user get -u Guest

  By role:

    $ apollo user get -r admin

  Use jq for more control:

    $ apollo user get | jq '.[] | select(.createdAt > "2024-03-18")'
```

_See code:
[src/commands/user/get.ts](https://github.com/GMOD/Apollo3/blob/v0.1.21/packages/apollo-cli/src/commands/user/get.ts)_
