# Assembly Permissions Module

This module introduces per-assembly Apollo annotation permissions.

## What this module owns

- Persistence of user x assembly grants (`canViewAnnotations`,
  `canEditAnnotations`)
- Admin CRUD API for grants
- Helper methods consumed by other modules (for example, write-path ACL checks
  in changes)

## Data model

The schema is defined in:

- `@apollo-annotation/schemas/src/assemblyPermission.schema.ts`

Key invariants:

- Unique grant document per `(userId, assemblyId)`
- `canEditAnnotations=true` always implies `canViewAnnotations=true`

## Endpoints

All endpoints are admin-only via `@Validations(Role.Admin)`.

- `GET /assemblyPermissions?userId=...&assemblyId=...`
  - list by optional filters
- `GET /assemblyPermissions/byUser/:userId`
  - list all grants for a user
- `GET /assemblyPermissions/byAssembly/:assemblyId`
  - list all grants for an assembly
- `PUT /assemblyPermissions/:userId/:assemblyId`
  - upsert one grant

Request body for `PUT`:

```json
{
  "canViewAnnotations": true,
  "canEditAnnotations": false
}
```

The controller extracts `req.user` and stores the caller as
`createdBy`/`updatedBy` metadata.

## Slice 2 write-path enforcement

`ChangesService.create()` now enforces assembly edit grants before applying
assembly-specific changes:

- Admin users bypass assembly grant checks
- Non-admin users must satisfy `canEdit(user.id, change.assembly)`
- Unauthorized write attempts return `UnprocessableEntityException`

Implementation location:

- `changes/changes.service.ts`

## Slice 2b read-path enforcement

Read operations now apply assembly view permissions.

- Features read endpoints (range, text search, count, get by id/indexed id,
  list) only return data from assemblies the caller can view
- Change history queries are filtered to assemblies the caller can view
- Admin users bypass assembly ACL filtering

Implementation locations:

- `features/features.controller.ts`
- `features/features.service.ts`
- `changes/changes.controller.ts`
- `changes/changes.service.ts`

## Testing

Current tests for this module:

- `assemblyPermissions.service.spec.ts` (service behavior and upsert rule)
- `assemblyPermissions.controller.spec.ts` (controller definition)
- `assemblyPermissions.integration.spec.ts` (HTTP route wiring with mocked
  service)

Recommended future test additions:

- Persistence-level tests against a test MongoDB (compound index + validation
  hook)
- Integration tests with auth guards enabled
- End-to-end tests validating denied/allowed write changes through `/changes`
