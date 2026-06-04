import { describe, expect, it } from '@jest/globals'

import {
  buildAssemblyPermissionRows,
  indexPermissionsByAssemblyId,
  normalizeAssemblyPermissionUpdate,
  type AssemblyPermissionResponse,
  type AssemblyResponse,
} from './manageUsersAssemblyPermissions'

describe('manageUsersAssemblyPermissions', () => {
  it('indexPermissionsByAssemblyId creates assembly-keyed map', () => {
    const permissions: AssemblyPermissionResponse[] = [
      {
        _id: 'p1',
        userId: 'u1',
        assemblyId: 'a1',
        canViewAnnotations: true,
        canEditAnnotations: false,
      },
      {
        _id: 'p2',
        userId: 'u1',
        assemblyId: 'a2',
        canViewAnnotations: true,
        canEditAnnotations: true,
      },
    ]

    const result = indexPermissionsByAssemblyId(permissions)

    expect(result.a1?._id).toBe('p1')
    expect(result.a2?._id).toBe('p2')
  })

  it('normalizeAssemblyPermissionUpdate enforces edit implies view', () => {
    const result = normalizeAssemblyPermissionUpdate({
      canViewAnnotations: false,
      canEditAnnotations: true,
    })

    expect(result).toEqual({
      canViewAnnotations: true,
      canEditAnnotations: true,
    })
  })

  it('buildAssemblyPermissionRows defaults missing permissions to false', () => {
    const assemblies: AssemblyResponse[] = [
      { _id: 'a1', name: 'asm1', displayName: 'Assembly 1' },
      { _id: 'a2', name: 'asm2' },
    ]
    const indexed = indexPermissionsByAssemblyId([
      {
        _id: 'p1',
        userId: 'u1',
        assemblyId: 'a1',
        canViewAnnotations: true,
        canEditAnnotations: false,
      },
    ])

    const rows = buildAssemblyPermissionRows(assemblies, indexed)

    expect(rows).toEqual([
      {
        id: 'a1',
        assemblyId: 'a1',
        assemblyName: 'Assembly 1',
        canViewAnnotations: true,
        canEditAnnotations: false,
      },
      {
        id: 'a2',
        assemblyId: 'a2',
        assemblyName: 'asm2',
        canViewAnnotations: false,
        canEditAnnotations: false,
      },
    ])
  })
})
