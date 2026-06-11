# Branch Audit and Resubmission Plan: feature_user_management_and_lint

## Branch and status

- Branch: `feature_user_management_and_lint`
- Current head: `5d2985e`
- Push workflow status (latest): success
- CI run:
  `https://github.com/USDA-REE-ARS/nal-i5k-apollo3/actions/runs/27367273968`

## Why this branch exists

This branch consolidates:

- auth/session hardening updates
- user/group assembly-permission management refinements
- broad lint remediation
- CI follow-up fixes for TypeScript and lint regressions
- Manage Users UI tab visibility improvements

## Baseline comparison options

### USDA baseline (recommended for resubmission to this repo)

- Base: `origin/docs/login-gov-pause-handoff-20260527`
- Delta to current head:
  - `42 files changed, 1547 insertions, 450 deletions`

Use this baseline when the target is the USDA Apollo3 repo.

### GMOD upstream baseline (recommended for upstream portability/risk scan)

- Base: `gmod/main` (fetched locally)
- Delta to current head:
  - `104 files changed, 7813 insertions, 429 deletions`

Use this baseline to understand long-running fork divergence and potential
upstream merge friction.

## Is delta from GMOD/Apollo3 easier?

Short answer: yes for architecture/drift analysis, no for immediate USDA
resubmission.

- Easier for audit depth:
  - quickly highlights where local fork behavior diverges from upstream defaults
  - surfaces compatibility risks before proposing upstream alignments
- Not the best single source for resubmission scope:
  - USDA target branch is the review surface that controls acceptance

Recommended approach:

1. Primary audit against USDA baseline for PR scope and reviewer clarity.
2. Secondary delta slice against GMOD main for divergence/risk notes.

## Change characterization (USDA baseline)

### Collaboration server

- Typing and lint hardening in assemblies, assemblyPermissions, auth, features,
  changes, and tests.
- Follow-up CI fixes:
  - DTO normalization typing in `assemblies.service.ts`
  - login.gov proxy agent typing in `login-gov.strategy.ts`
  - lint rule fix (`unicorn/no-nested-ternary`) in
    `assemblyPermissions.service.ts`

### JBrowse plugin Apollo

- Session/auth and account flow safety updates.
- Manage Users refinements and stronger tab visibility styling.
- Component-level lint and typing cleanup across admin/user management screens.

### CLI and docs

- permission command lint cleanups and README/help updates.
- lint remediation log updated with wave tracking and outcomes.

## New/updated user-visible behavior to document

1. Manage Users tab UX:
   - tabs now have stronger visual affordance and compact, high-contrast
     selected states.
2. Group/user permission management clarity:
   - Current state/Edit views remain unchanged functionally, but are more
     discoverable.
3. Auth/session reliability improvements:
   - login and session handling hardened in recent branch waves.

## Full audit checklist

### Code quality and safety

1. Confirm no hidden behavior changes in:
   - auth/session state transitions
   - assembly/group permission toggles
   - collaboration-service update paths
2. Re-run targeted unit/integration tests for modified collaboration-service
   modules.
3. Ensure strict lint remains green in CI (already green on latest run).

### API and schema compatibility

1. Verify response shapes for effective permissions endpoints.
2. Verify login.gov strategy changes do not alter runtime behavior except type
   safety.
3. Confirm no contract drift in CLI command outputs.

### UI/UX verification

1. Validate Manage Users tabs on desktop and narrow viewport.
2. Validate User management, Group management, Group permissions flows
   end-to-end.
3. Confirm no accessibility regressions (focus, selected state visibility).

### Documentation readiness

1. Keep `LINT_REMEDIATION_2026-06-11.md` aligned with final CI outcomes.
2. Add concise release summary for:
   - lint/typing stabilization
   - permission management UX improvements
   - CI blockers and their fixes

## Suggested PR structure for resubmission

1. PR summary
   - one paragraph on intent and risk profile
2. What changed
   - grouped by collaboration server, plugin UI, CLI/docs
3. Why it is safe
   - CI run links and key test notes
4. Reviewer guide
   - high-priority files and behavior checks
5. Follow-ups (optional)
   - upstream drift reductions from GMOD comparison
