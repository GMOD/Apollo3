# Assembly ACL in Changes Service

## Summary

Write-path ACL is enforced in `ChangesService.create()` before any mutation
handlers run.

## Rule

For assembly-specific changes:

- `admin` role: allowed (bypass)
- `user` / `readOnly` / `none`: requires
  `AssemblyPermissionsService.canEdit(user.id, change.assembly)`

If unauthorized, the service throws `UnprocessableEntityException`.

## Why this is here

This check prevents unauthorized API clients from bypassing UI restrictions by
posting changes directly. UI-level hiding/disable logic is not sufficient for
security.

## Scope currently covered

- Assembly-scoped write operations submitted through `/changes`
- Change history reads through `/changes` are filtered by assembly view grants
  for non-admin users

## Follow-up slices

- Read-path assembly ACL filtering in features/search/count endpoints
- Optional stricter status codes or a dedicated authorization exception class
- Include assembly ACL decisions in audit logging
