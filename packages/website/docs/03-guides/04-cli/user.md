# `apollo user`

Commands to manage users

- [`apollo user add`](#apollo-user-add)
- [`apollo user get`](#apollo-user-get)

## `apollo user add`

Add a user by email before they have logged in

```
USAGE
  $ apollo user add -e <value> [--profile <value>] [--config-file <value>] [--timeout <value>] [-r
    admin|user|readOnly|none]

FLAGS
  -e, --email=<value>        (required) Email of the user to add
  -r, --role=<option>        [default: user] Role of the user to add
                             <options: admin|user|readOnly|none>
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

DESCRIPTION
  Add a user by email before they have logged in

  The user is created without a username, which is filled in when they log in for the first time. They will have the
  given role when they log in.

EXAMPLES
  Add a user with the default "user" role:

    $ apollo user add -e jane.doe@example.com

  Add a user with the "readOnly" role:

    $ apollo user add -e jane.doe@example.com -r readOnly
```

_See code:
[src/commands/user/add.ts](https://github.com/GMOD/Apollo3/blob/v1.1.3/packages/apollo-cli/src/commands/user/add.ts)_

## `apollo user get`

Get list of users

```
USAGE
  $ apollo user get [--profile <value>] [--config-file <value>] [--timeout <value>] [-u <value>] [-r <value>]

FLAGS
  -r, --role=<value>         Get users with this role
  -u, --username=<value>     Find this username
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile
      --timeout=<value>      [default: 1h] Timeout for each request to the server

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
[src/commands/user/get.ts](https://github.com/GMOD/Apollo3/blob/v1.1.3/packages/apollo-cli/src/commands/user/get.ts)_
