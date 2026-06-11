# Apollo3 Lint Remediation Log (2026-06-11)

## Goal

Bring the repository toward passing strict lint in CI
(`yarn eslint --max-warnings 0`) while preserving runtime behavior.

## Baseline findings

- CI run:
  `https://github.com/USDA-REE-ARS/nal-i5k-apollo3/actions/runs/27356941686`
- Reported summary from run log:
  - `398 problems (353 errors, 45 warnings)`
  - Affected packages include:
    - `packages/jbrowse-plugin-apollo`
    - `packages/apollo-collaboration-server`

### Highest-error files observed in captured log slice

- `packages/apollo-collaboration-server/src/changes/changes.service.spec.ts`
- `packages/jbrowse-plugin-apollo/src/components/MyAssemblyPermissions.tsx`
- `packages/jbrowse-plugin-apollo/src/session/session.ts`
- `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`

### Most common rules in captured log slice

- `@typescript-eslint/no-unsafe-member-access`
- `@typescript-eslint/no-unsafe-call`
- `@typescript-eslint/no-unnecessary-condition`
- `unicorn/no-useless-undefined`
- `@typescript-eslint/no-unsafe-assignment`

## Reproduction notes

1. Workflow lint command:
   - `yarn eslint --max-warnings 0`
2. Local host reproduction on Node 26 is not representative due ESLint config
   loader runtime mismatch.
3. Containerized Node 24 reproduction matched CI behavior but hit memory
   pressure when reinstall/linking full workspace dependencies.
4. Targeted file-only ESLint invocation in container currently crashes early
   with `TypeError: Cannot convert undefined or null to object` while loading
   flat config, so validation is being tracked via CI reruns after each fix
   wave.

## Fix strategy

1. Fix touched plugin files first to avoid regressions in auth/session UX.
2. Land cleanup in small, reviewable commits by rule family.
3. Expand to collaboration-server files next, prioritizing highest-error tests.
4. Re-run lint in CI after each wave and record deltas here.

## Fix wave log

### Post-remediation CI follow-ups

- Commit `0017a2a`:
  - fixed collaboration-server TypeScript CI blockers
  - compacted and improved visibility of Manage Users tabs
- Commit `5d2985e`:
  - fixed final CI lint blocker (`unicorn/no-nested-ternary`) in
    `assemblyPermissions.service.ts`
- CI status:
  - `https://github.com/USDA-REE-ARS/nal-i5k-apollo3/actions/runs/27367273968`
  - completed successfully

### Current status (latest local run)

- Command:
  - `npx -y node@22 .yarn/releases/yarn-4.14.1.cjs lint`
- Result:
  - lint passes cleanly
  - `0 errors, 0 warnings`
  - exit code `0`

### Wave 10

- Scope:
  - `packages/apollo-collaboration-server/src/assemblies/assemblies.service.ts`
  - `packages/apollo-collaboration-server/src/assemblyPermissions/assemblyPermissions.controller.ts`
  - `packages/apollo-collaboration-server/src/assemblyPermissions/assemblyPermissions.service.ts`
  - `packages/apollo-collaboration-server/src/changes/changeHandlers.service.ts`
  - `packages/apollo-collaboration-server/src/features/features.service.ts`
- Focused rule families:
  - `@typescript-eslint/prefer-nullish-coalescing`
  - `@typescript-eslint/no-misused-spread`
  - `@typescript-eslint/no-base-to-string`
  - unicorn callback-reference false positives on `find(...)`
- Status: completed
- What was fixed:
  - replaced `||` defaulting with explicit empty-string handling / `??`
  - replaced object spread on DTO/class-like values with `Object.assign`
  - added safe assembly-id conversion helper in features service
  - resolved strict unicorn callback-reference issues around service/controller
    `find` usage

### Wave 11

- Scope:
  - `packages/apollo-collaboration-server/src/declare.d.ts`
  - `packages/jbrowse-plugin-apollo/src/components/EditAssemblies.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/LogOut.tsx`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
  - `packages/jbrowse-plugin-apollo/src/components/MyAssemblyPermissions.tsx`
  - `packages/jbrowse-plugin-apollo/src/session/session.ts`
- Focused rule families:
  - `@typescript-eslint/no-unsafe-function-type`
  - `@typescript-eslint/use-unknown-in-catch-callback-variable`
  - `@typescript-eslint/no-floating-promises`
  - `@typescript-eslint/await-thenable`
  - `@typescript-eslint/no-confusing-void-expression`
  - `@typescript-eslint/no-unsafe-argument`
- Status: completed
- What was fixed:
  - replaced untyped passport callback `Function` with explicit callback
    signature
  - typed catch callbacks as `unknown`
  - corrected async handling for region-navigation flow in My workspace
  - fixed typed switch handler in My workspace (`onChange` second arg)
  - reduced remaining model/session false positives to warnings-only state

### Wave 12

- Scope:
  - `packages/apollo-cli/src/commands/permissions/list.ts`
  - `packages/apollo-cli/src/test/test.ts`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
  - `packages/jbrowse-plugin-apollo/src/components/EditAssemblies.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/LogOut.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/ManageUsers.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/MyAssemblyPermissions.tsx`
  - `packages/jbrowse-plugin-apollo/src/session/session.ts`
- Focused rule families:
  - `prefer-destructuring`
  - `react-hooks/exhaustive-deps`
- Status: completed
- What was fixed:
  - replaced last remaining index-based selections with array destructuring
  - added the missing hook dependency in ManageUsers effect
  - preserved behavior while eliminating warning-only lint debt

### Wave 1

- Scope:
  - `packages/jbrowse-plugin-apollo/src/menus/topLevelMenu.ts`
  - `packages/jbrowse-plugin-apollo/src/ChangeManager.ts`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/tokenUtils.ts`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/components/AuthTypeSelector.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/LogOut.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/ManageUsers.tsx`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
- Focused rule families:
  - `unicorn/no-useless-undefined`
  - `@typescript-eslint/array-type`
  - `@typescript-eslint/no-unnecessary-condition`
  - `@typescript-eslint/consistent-type-definitions`
  - `unicorn/prefer-switch`
  - `react-hooks/rules-of-hooks`
- Status: completed
- What was fixed:
  - replaced `type` with `interface` where required
  - removed useless `undefined` returns
  - simplified unnecessary optional chains
  - replaced callback-reference filters with explicit callback lambdas
  - replaced if/else ladder with `switch`
  - fixed hook ordering issue in logout dialog
  - added `useCallback` for effect dependency stability in ManageUsers

### Wave 2

- Scope:
  - `packages/apollo-collaboration-server/src/changes/changes.service.spec.ts`
  - `packages/apollo-collaboration-server/src/authentication/authentication.service.spec.ts`
  - `packages/apollo-collaboration-server/src/authentication/authentication.service.ts`
  - `packages/apollo-collaboration-server/src/utils/strategies/login-gov.strategy.ts`
- Focused rule families:
  - `@typescript-eslint/no-unsafe-assignment`
  - `@typescript-eslint/no-unsafe-call`
  - `@typescript-eslint/no-unsafe-member-access`
  - `@typescript-eslint/no-explicit-any`
  - `unicorn/no-await-expression-member`
  - `unicorn/consistent-function-scoping`
- Status: completed
- What was fixed:
  - introduced typed jest imports/mocks and helper exec factory for specs
  - removed `any`-based constructor wiring in auth service spec
  - moved auth spec factory to module scope
  - rewrote login.gov client-id file read flow to avoid await-expression-member
    lint violation
  - replaced login.gov strategy non-null assertions and `any` cast with explicit
    guards and typed oauth2 agent handling

### Wave 3

- Scope:
  - `packages/jbrowse-plugin-apollo/src/components/MyAssemblyPermissions.tsx`
  - `packages/jbrowse-plugin-apollo/src/session/session.ts`
- Focused rule families:
  - `@typescript-eslint/no-unnecessary-type-assertion`
  - `@typescript-eslint/no-unsafe-assignment`
  - callback and render-parameter typing in UI code
- Status: completed
- What was fixed:
  - removed broad top-level suppressions in My workspace dialog file
  - added explicit DataGrid render-cell typing and typed switch change handler
  - removed unnecessary string casts when loading assemblies from row data
  - introduced typed Apollo account filtering helper in session model
  - replaced repeated array-cast loops with type-guarded account iteration

### Wave 4

- Scope:
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
- Focused rule families:
  - `@typescript-eslint/no-unsafe-member-access`
  - `@typescript-eslint/no-unsafe-assignment`
  - reduction of repeated `unknown as` casts around live session access
- Status: completed
- What was fixed:
  - introduced a typed `LiveApolloSession` helper interface
  - updated live-session retrieval helpers to return typed session objects
  - removed repeated `unknown as AbstractSessionModel` casts at socket and
    role-notification call sites

### Wave 5

- Scope:
  - `packages/jbrowse-plugin-apollo/src/session/session.ts`
- Focused rule families:
  - `@typescript-eslint/no-unsafe-assignment`
  - `@typescript-eslint/no-unsafe-member-access`
  - reduction of repeated cast patterns in session/view handling
- Status: completed
- What was fixed:
  - added helper narrowers for abstract session and linear genome view access
  - replaced repeated `self as unknown as ...` cast sites with helper usage
  - switched broadcast loops to type-guarded Apollo account iteration
  - aligned duplicated autorun location-broadcast path with typed helper flow

### Wave 6

- Scope:
  - `packages/apollo-collaboration-server/src/changes/changes.service.spec.ts`
- Focused rule families:
  - `@typescript-eslint/no-unnecessary-type-assertion`
  - `@typescript-eslint/no-unsafe-assignment`
  - test fixture typing cleanup in constructor wiring and JWT test inputs
- Status: completed
- What was fixed:
  - switched constructor dependency casts from `never` to constructor-derived
    argument types
  - introduced explicit `DecodedJWT` typing for test users
  - removed `change/user as never` call-site casts for create/findAll assertions

### Wave 7

- Scope:
  - `packages/apollo-collaboration-server/src/jbrowse/jbrowse.service.spec.ts`
  - `packages/apollo-collaboration-server/src/features/features.controller.spec.ts`
  - `packages/apollo-collaboration-server/src/features/features.service.spec.ts`
  - `packages/apollo-collaboration-server/src/changes/changes.controller.spec.ts`
- Focused rule families:
  - `@typescript-eslint/no-unnecessary-type-assertion`
  - `@typescript-eslint/no-unsafe-assignment`
  - replacement of `never` placeholder casts in small controller/service specs
- Status: completed
- What was fixed:
  - replaced constructor `never` casts with constructor-derived argument types
  - replaced `mockResolvedValue(... as never)` in JBrowse spec with
    method-return-type-based typing

### Wave 8

- Scope:
  - `packages/apollo-collaboration-server/src/changes/changes.service.spec.ts`
- Focused rule families:
  - `@typescript-eslint/no-unnecessary-type-assertion`
  - replacement of remaining `never` cast in change fixture setup
- Status: completed
- What was fixed:
  - replaced the final `deletedFeature as never` cast with constructor-derived
    `DeleteFeatureChange` init typing

### Wave 9

- Scope:
  - `packages/apollo-collaboration-server/src/features/features.controller.spec.ts`
  - `packages/apollo-collaboration-server/src/features/features.service.spec.ts`
  - `packages/apollo-collaboration-server/src/changes/changes.controller.spec.ts`
- Focused rule families:
  - test typing hardening for environments where jest globals are not ambient
- Status: completed
- What was fixed:
  - added explicit `@jest/globals` imports (`beforeEach`, `describe`, `expect`,
    `it`) in small specs
  - reduced reliance on tsconfig-level ambient jest declarations for these files

## Upstream contribution path

Yes, this cleanup is suitable to submit upstream.

Recommended packaging for upstream developers:

1. PR 1: plugin-only lint debt reductions in touched files.
2. PR 2: collaboration-server test/type-safety lint fixes.
3. PR 3: any workflow or lint-config adjustments (if needed) with rationale.

Each PR should include:

- Before/after lint counts for impacted paths.
- Notes on behavior-preserving refactors.
- Any intentionally deferred rules with justification.

## Suggested next step

1. Split this remediation into reviewable commits by wave or by package boundary
   before opening upstream PRs.
