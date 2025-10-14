# Administrators

In order to do things like add new assemblies, import annotations from a file,
and manage the roles of other users, you will need to be an administrator. This
means your user account will need to have the role of `Admin`.

When Apollo is first set up, the first user who logs in is automatically made an
administrator. Any other users who log in after that will be given the role set
by `DEFAULT_NEW_USER_ROLE` in the
[configuration options](../installation/configuration-options). An administrator
can make another user into an administrator as well.

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
- [Managing users](users)
- [Adding evidence tracks](evidence-tracks)
