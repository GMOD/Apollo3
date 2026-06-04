# Assembly ACL Rollout Runbook

This runbook describes how to safely enable and validate assembly-level
annotation permissions in Apollo.

## Scope

Assembly ACL controls access to Apollo annotation reads and writes per assembly,
per user.

- Admin users bypass assembly grants.
- Non-admin users need grants per assembly.
- `canEditAnnotations=true` implies `canViewAnnotations=true`.

## Preconditions

Before rollout, verify:

1. You have at least one admin account with confirmed login access.
2. Collaboration server and plugin builds include assembly ACL changes.
3. Database backup and rollback plan are available.
4. A test set of users and assemblies is prepared.

## Cutover Checklist

1. Deploy server and plugin versions that include assembly ACL endpoints and UI.
2. Confirm server health endpoint is healthy.
3. Seed initial assembly grants for existing users.
4. Validate representative role matrix:
   - admin user can read/write all assemblies
   - read-only user can read only granted assemblies
   - user role can write only granted assemblies
5. Validate CLI permission commands against production config profile.
6. Announce cutover completion and provide support contact.

## Seeding Grants (CLI)

Examples:

```sh
apollo permissions grant --profile admin -u admin@example.org -a asm1 asm2 --edit
apollo permissions grant --profile admin -u curator@example.org -a asm1 --edit
apollo permissions grant --profile admin -u reviewer@example.org -a asm1 --view
apollo permissions list --profile admin -u reviewer@example.org
```

## Verification Checklist

Run these checks after seeding:

1. `apollo permissions list` returns expected records.
2. `apollo feature get` only returns rows for assemblies user can view.
3. `apollo change get` only shows changes for assemblies user can view.
4. Submitting changes on unauthorized assemblies fails.
5. Submitting changes on authorized assemblies succeeds.

## Rollback Checklist

Use rollback if severe authorization regressions occur.

1. Stop new writes from non-admin users (maintenance communication).
2. Roll back collaboration server and plugin to prior stable versions.
3. Verify health and core read paths.
4. Keep permission documents in DB unless schema rollback is required.
5. Re-run smoke checks for login, feature reads, and change submission.
6. Publish incident update with known impact and next window.

## Post-Rollback Recovery

1. Capture failing scenarios and user IDs/assemblies affected.
2. Reproduce in staging with the same grant dataset.
3. Patch and validate with CLI + UI checks.
4. Re-schedule rollout with a narrower canary set first.
