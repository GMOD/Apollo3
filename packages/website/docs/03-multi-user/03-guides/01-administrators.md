# Administrators

In order to do things like add new assemblies, import annotations from a file,
and manage the roles of other users, you will need to be an administrator. This
means your user account will need to have the role of `Admin`.

When Apollo is first set up, the first user who logs in is automatically made an
administrator. Any other users who log in after that will be given the role set
by `DEFAULT_NEW_USER_ROLE` in the
[configuration options](../installation/configuration-options). An administrator
can make another user into an administrator as well.

If you want to choose who the first administrator is, set `INITIAL_ADMIN_EMAIL`
to that person's email. They will be made an administrator, and nobody else
(except the root user) will be able to log in until they have logged in for the
first time.

## Adding users before they log in

An administrator can add a user by email before that person has logged in, and
choose the role they will have. In the "Apollo" menu, go to "Admin" -> "Manage
Users" and click "Add user", or use the CLI:

```sh
apollo user add --email jane.doe@example.com --role user
```

Until they log in, the user is shown as "Pending first login". When they log in
for the first time, their name is filled in and they get the role that was
chosen.

By default, anyone who can sign in with one of the configured authentication
providers (e.g. any Google account) can log in, and they get the
`DEFAULT_NEW_USER_ROLE`. To only allow users an administrator has added, set
`ONLY_ALLOW_APPROVED_USERS=true`. Logins from anyone else will be rejected, and
no user will be created for them. Users who had already logged in before this
was turned on can still log in.

There is also the option to have a single user, referred to as the "root user",
with an `Admin` role that is able to authenticate without logging in via OAuth.
This is meant to be used to simplify running CLI commands as an administrator.
By default this user is disabled, but can be enabled with the `ALLOW_ROOT_USER`
and `ROOT_USER_PASSWORD` options in the
[configuration options](../installation/configuration-options).

## How to access administrator capabilities

There are two ways to access administrator capabilities in Apollo. The first is
through the menus in the user interface. The top-level "Apollo" menu has a
sub-menu called "Admin" that appears for those logged in as an administrator.
These menu items include operations like adding assemblies and importing
annotations.

The second way to access administrator capabilities in Apollo is by using the
Apollo CLI. The CLI provides the same options as using the GUI, but may be more
useful for users who want to automate some of the administration tasks or who
want to keep a log of what commands were run to set up Apollo.

Each guide in this section will give instructions for both the GUI and the CLI,
if applicable.

## Common administrator actions

Here are some of the most commonly-performed administrator tasks, and links to
the guide that explains each one:

- [Adding assemblies](assemblies)
- [Importing annotation features](annotation-features)
<!-- - [Managing users](users) -->
- [Adding evidence tracks](evidence-tracks)
