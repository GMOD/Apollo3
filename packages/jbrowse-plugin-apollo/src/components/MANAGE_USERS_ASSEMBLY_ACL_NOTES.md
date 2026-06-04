# Manage Users Assembly ACL Notes

## Purpose

This document explains the assembly-permission UI that was added to the Manage
Users dialog.

## Where the logic lives

- `components/ManageUsers.tsx`
- `components/manageUsersAssemblyPermissions.ts`

The dialog now has two admin panels:

- User role management (existing behavior)
- Assembly permission management (new behavior)

## API usage

The component calls collaboration server endpoints via the selected Apollo
internet account fetcher.

Read paths:

- `GET /users`
- `GET /assemblies`
- `GET /assemblyPermissions/byUser/:userId`

Write path:

- `PUT /assemblyPermissions/:userId/:assemblyId`

## State model in ManageUsers

- `users`: user list from `/users`
- `assemblies`: assembly list from `/assemblies`
- `selectedUserId`: currently managed user for assembly grants
- `assemblyPermissionsByAssemblyId`: local cache of grant documents keyed by
  assembly id

## Edit behavior

Each assembly row has two editable booleans:

- `canViewAnnotations`
- `canEditAnnotations`

Invariant enforced in UI and backend:

- `canEditAnnotations=true` implies `canViewAnnotations=true`

When a row is edited, the component normalizes the payload before sending:

- if edit is true, view is forced true

Normalization helper:

- `normalizeAssemblyPermissionUpdate()`

Row-building helper:

- `buildAssemblyPermissionRows()`

Permission indexing helper:

- `indexPermissionsByAssemblyId()`

## Error handling

All request failures are converted into user-facing messages using
`createFetchErrorMessage` and shown at the bottom of the dialog.

## Known follow-up

Current implementation supports one-user-at-a-time grant edits. Bulk grant
actions and assembly filtering are intentionally deferred for a later slice.

## Unit tests

Helper-level tests for the new logic are in:

- `components/manageUsersAssemblyPermissions.test.ts`

The tests currently cover:

- assembly permission indexing by assembly id
- edit-implies-view normalization
- assembly row construction defaults when no grant exists
