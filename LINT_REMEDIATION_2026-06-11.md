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

1. Fix changed plugin files first (security/auth/session work already in
   progress).
2. Land cleanup in small, reviewable commits by rule family.
3. Expand to collaboration-server files next, focusing on high-count files.
4. Re-run lint in CI after each fix wave and record delta here.

## Fix wave log

### Wave 1 (in progress)

- Scope:
  - `packages/jbrowse-plugin-apollo/src/menus/topLevelMenu.ts`
  - `packages/jbrowse-plugin-apollo/src/ChangeManager.ts`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/tokenUtils.ts`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/components/AuthTypeSelector.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/LogOut.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/ManageUsers.tsx`
- Focused rule families:
  - `unicorn/no-useless-undefined`
  - `@typescript-eslint/array-type`
  - `@typescript-eslint/no-unnecessary-condition`
  - `@typescript-eslint/consistent-type-definitions`
  - `unicorn/prefer-switch`
  - `react-hooks/rules-of-hooks` (structural fixes only)

### Wave 1 status

- Completed edits in:
  - `packages/jbrowse-plugin-apollo/src/menus/topLevelMenu.ts`
  - `packages/jbrowse-plugin-apollo/src/ChangeManager.ts`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/tokenUtils.ts`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/components/AuthTypeSelector.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/LogOut.tsx`
  - `packages/jbrowse-plugin-apollo/src/components/ManageUsers.tsx`
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
- What was fixed in this wave:
  - replaced `type` with `interface` where required
  - removed useless `undefined` returns
  - simplified unnecessary optional chains
  - replaced callback-reference filters with explicit callback lambdas
  - replaced if/else ladder with `switch`
  - fixed hook ordering issue in logout dialog
  - added `useCallback` for effect dependency stability in ManageUsers

### Wave 2 (in progress)

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

### Wave 2 status

- Completed edits in:
  - `packages/apollo-collaboration-server/src/changes/changes.service.spec.ts`
  - `packages/apollo-collaboration-server/src/authentication/authentication.service.spec.ts`
  - `packages/apollo-collaboration-server/src/authentication/authentication.service.ts`
  - `packages/apollo-collaboration-server/src/utils/strategies/login-gov.strategy.ts`
- What was fixed in this wave:
  - introduced typed jest imports/mocks and helper exec factory for specs
  - removed `any`-based constructor wiring in auth service spec
  - moved auth spec factory to module scope
  - rewrote login.gov client-id file read flow to avoid await-expression-member
    lint violation
  - replaced login.gov strategy non-null assertions and `any` cast with explicit
    guards and typed oauth2 agent handling

### Wave 3 (in progress)

- Scope:
  - `packages/jbrowse-plugin-apollo/src/components/MyAssemblyPermissions.tsx`
  - `packages/jbrowse-plugin-apollo/src/session/session.ts`
- Focused rule families:
  - `@typescript-eslint/no-unnecessary-type-assertion`
  - `@typescript-eslint/no-unsafe-assignment`
  - `@typescript-eslint/no-unsafe-call`
  - callback typing and explicit render param typing in UI code

### Wave 3 status

- Completed edits in:
  - `packages/jbrowse-plugin-apollo/src/components/MyAssemblyPermissions.tsx`
  - `packages/jbrowse-plugin-apollo/src/session/session.ts`
- What was fixed in this wave:
  - removed broad top-level eslint suppressions in My workspace dialog file
  - added explicit DataGrid render-cell typing and typed switch change handler
  - removed unnecessary string casts when loading assemblies from row data
  - introduced typed Apollo account filtering helper in session model
  - replaced repeated array-cast loops with type-guarded account iteration

### Wave 4 (in progress)

- Scope:
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
- Focused rule families:
  - `@typescript-eslint/no-unsafe-member-access`
  - `@typescript-eslint/no-unsafe-assignment`
  - reduction of repeated `unknown as` casts around live session access

### Wave 4 status

- Completed edits in:
  - `packages/jbrowse-plugin-apollo/src/ApolloInternetAccount/model.ts`
- What was fixed in this wave:
  - introduced a typed `LiveApolloSession` helper interface
  - updated live-session retrieval helpers to return typed session objects
  - removed repeated `unknown as AbstractSessionModel` casts at socket and
    role-notification call sites

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
