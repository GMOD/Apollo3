# CLI Permissions Commands

This folder defines assembly ACL management commands for the Apollo CLI.

Commands:

- `apollo permissions list`
- `apollo permissions grant`
- `apollo permissions revoke`

Resolution behavior:

- User input supports user id, username, or email.
- Assembly input supports assembly id or common assembly name.

Grant semantics:

- `--edit` implies `canViewAnnotations=true`.
- If no explicit permission flags are provided to `grant`, it defaults to
  view-only.

Implementation notes:

- Commands call collaboration-server endpoint `assemblyPermissions`.
- `grant` and `revoke` perform `PUT` upserts per assembly.
