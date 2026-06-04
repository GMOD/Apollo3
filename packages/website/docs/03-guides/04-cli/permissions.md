# `apollo permissions`

Commands to manage assembly permissions

- [`apollo permissions grant`](#apollo-permissions-grant)
- [`apollo permissions list`](#apollo-permissions-list)
- [`apollo permissions revoke`](#apollo-permissions-revoke)

## `apollo permissions grant`

Grant assembly permissions to a user

```
USAGE
  $ apollo permissions grant -u <value> -a <value> [--profile <value>] [--config-file <value>] [--view] [--edit]

FLAGS
  -a, --assembly=<value>...  (required) Assembly name or id
  -u, --user=<value>         (required) User id, username, or email
      --config-file=<value>  Use this config file (mostly for testing)
      --edit                 Grant edit permission (implies view)
      --profile=<value>      Use credentials from this profile
      --view                 Grant view permission

DESCRIPTION
  Grant assembly permissions to a user

  Grants annotation permissions for one user across one or more assemblies.

EXAMPLES
  Grant view access to one assembly:

    $ apollo permissions grant -u user@example.org -a myAssembly --view

  Grant edit access to multiple assemblies (implies view):

    $ apollo permissions grant -u user@example.org -a asm1 asm2 --edit
```

_See code:
[src/commands/permissions/grant.ts](https://github.com/GMOD/Apollo3/blob/v1.0.0/packages/apollo-cli/src/commands/permissions/grant.ts)_

## `apollo permissions list`

List assembly permissions

```
USAGE
  $ apollo permissions list [--profile <value>] [--config-file <value>] [-u <value>] [-a <value>]

FLAGS
  -a, --assembly=<value>     Filter by one assembly name or id
  -u, --user=<value>         Filter by user id, username, or email
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  List assembly permissions

  Lists assembly permission documents, optionally filtered by user and/or assembly.

EXAMPLES
  List all permissions:

    $ apollo permissions list

  List permissions for one user:

    $ apollo permissions list -u user@example.org

  List permissions for one assembly:

    $ apollo permissions list -a myAssembly
```

_See code:
[src/commands/permissions/list.ts](https://github.com/GMOD/Apollo3/blob/v1.0.0/packages/apollo-cli/src/commands/permissions/list.ts)_

## `apollo permissions revoke`

Revoke assembly permissions from a user

```
USAGE
  $ apollo permissions revoke -u <value> -a <value> [--profile <value>] [--config-file <value>]

FLAGS
  -a, --assembly=<value>...  (required) Assembly name or id
  -u, --user=<value>         (required) User id, username, or email
      --config-file=<value>  Use this config file (mostly for testing)
      --profile=<value>      Use credentials from this profile

DESCRIPTION
  Revoke assembly permissions from a user

  Revokes annotation permissions for one user across one or more assemblies.

EXAMPLES
  Revoke access from one assembly:

    $ apollo permissions revoke -u user@example.org -a myAssembly
```

_See code:
[src/commands/permissions/revoke.ts](https://github.com/GMOD/Apollo3/blob/v1.0.0/packages/apollo-cli/src/commands/permissions/revoke.ts)_
