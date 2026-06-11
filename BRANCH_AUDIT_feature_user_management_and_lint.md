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

## Phase 1 audit results (2026-06-11)

### Findings (ordered by severity)

1. High: plugin build is green but still emits TypeScript diagnostics.

   - Impact: CI currently treats these as warnings, but they indicate
     type-safety debt in authentication/session and Manage Users paths.
   - Evidence:
     - `src/ApolloInternetAccount/model.ts` TS2339 around `authType` narrowing.
     - `src/components/ManageUsers.tsx` TS2322/TS2345 for grid row typing.
     - `src/components/MyAssemblyPermissions.tsx` TS2305 for `ChangeEvent`
       import source.
     - `src/session/session.ts` TS2345/TS2339 on account and config typing.
   - Recommendation:
     - Add a hard TypeScript check job for `jbrowse-plugin-apollo` (or enforce
       rollup plugin diagnostics as failing) before final upstream resubmission.

2. Medium: local targeted test execution is not currently reproducible in this
   environment due Jest runtime mismatch.

   - Impact: reduced local confidence for changed permission/auth test surfaces.
   - Evidence:
     - Running targeted tests in `apollo-collaboration-server` hit:
       `TypeError: require.resolve.paths is not a function`.
   - Recommendation:
     - Capture a pinned local test command (Node/tooling) that matches CI runner
       semantics, or add a dedicated CI test workflow for changed modules.

3. Low: no functional regressions observed in audited backend delta for
   collaboration-service CI blockers.
   - Evidence:
     - Latest push workflow succeeded:
       `https://github.com/USDA-REE-ARS/nal-i5k-apollo3/actions/runs/27367273968`
     - Collaboration server build passed locally after fixes.

### Evidence matrix

1. CI push workflow

   - Command/context: GitHub Actions run for branch head.
   - Result: pass.
   - Link:
     - `https://github.com/USDA-REE-ARS/nal-i5k-apollo3/actions/runs/27367273968`

2. Collaboration server build

   - Command:
     - `npx -y node@24 ../../.yarn/releases/yarn-4.14.1.cjs build`
   - Location:
     - `packages/apollo-collaboration-server`
   - Result: pass.

3. Plugin build

   - Command:
     - `JB_NPM=false npx -y node@24 ../../.yarn/releases/yarn-4.14.1.cjs build`
   - Location:
     - `packages/jbrowse-plugin-apollo`
   - Result: bundle built, multiple TypeScript diagnostics emitted.

4. Targeted collaboration-service tests
   - Command:
     - `npx -y node@24 ../../.yarn/releases/yarn-4.14.1.cjs test src/assemblyPermissions/assemblyPermissions.service.spec.ts src/assemblyPermissions/assemblyPermissions.integration.spec.ts`
   - Result: environment/runtime error (`require.resolve.paths` mismatch), not a
     test assertion failure.

### Characterized feature updates for docs

1. User management UX

   - Manage Users tabs now use compact high-contrast states to improve
     discoverability in admin workflows.

2. Auth/session handling

   - Session/account token handling hardening with safer account selection and
     guest fallback flow adjustments.

3. Permissions and collaboration server robustness
   - Effective permission source assignment and DTO typing changes aligned to CI
     lint/TypeScript requirements.

### Resubmission readiness verdict (Phase 1)

1. Ready for USDA resubmission with caveat.

   - Caveat: plugin TypeScript diagnostics should be triaged or explicitly
     accepted as non-blocking technical debt in PR notes.

2. Recommended before final merge:
   - add a short "known non-blocking TS diagnostics" section in PR description
     (or fix them in a follow-up hardening pass).

## PR narrative draft

### Summary

This branch hardens Apollo auth/session and permissions flows, completes a
multi-wave lint remediation, and resolves CI blockers observed during
resubmission. It also improves discoverability of the Manage Users admin tabs
with compact, high-contrast styling.

### What changed

1. Collaboration server

   - fixed CI TypeScript issues in assemblies update normalization and login.gov
     strategy typing
   - resolved lint blocker in effective permission source mapping

2. Plugin UI/session

   - improved Manage Users tab visibility and compactness
   - refined session/account handling and My workspace permission navigation

3. CLI/docs
   - command/test lint cleanups and remediation documentation updates

### Why this is safe

1. Latest push workflow is green:
   - `https://github.com/USDA-REE-ARS/nal-i5k-apollo3/actions/runs/27367273968`
2. Collaboration server build validated locally.

### Reviewer guide

1. Backend CI fixes:
   - `packages/apollo-collaboration-server/src/assemblies/assemblies.service.ts`
   - `packages/apollo-collaboration-server/src/utils/strategies/login-gov.strategy.ts`
   - `packages/apollo-collaboration-server/src/assemblyPermissions/assemblyPermissions.service.ts`
2. Admin UX tabs:
   - `packages/jbrowse-plugin-apollo/src/components/ManageUsers.tsx`
3. Session/workspace flow updates:
   - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
   - `packages/jbrowse-plugin-apollo/src/session/session.ts`
   - `packages/jbrowse-plugin-apollo/src/components/MyAssemblyPermissions.tsx`
