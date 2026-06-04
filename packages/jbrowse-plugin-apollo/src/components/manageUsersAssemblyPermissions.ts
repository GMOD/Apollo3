export interface AssemblyResponse {
  _id: string
  name: string
  displayName?: string
}

export interface AssemblyPermissionResponse {
  _id: string
  userId: string
  assemblyId: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

export interface AssemblyPermissionRow {
  id: string
  assemblyId: string
  assemblyName: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

export interface AssemblyPermissionUpdateInput {
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

export function indexPermissionsByAssemblyId(
  permissions: AssemblyPermissionResponse[],
): Partial<Record<string, AssemblyPermissionResponse>> {
  const byAssemblyId: Partial<Record<string, AssemblyPermissionResponse>> = {}
  for (const permission of permissions) {
    byAssemblyId[permission.assemblyId] = permission
  }
  return byAssemblyId
}

export function normalizeAssemblyPermissionUpdate(
  input: AssemblyPermissionUpdateInput,
): AssemblyPermissionUpdateInput {
  const canEditAnnotations = Boolean(input.canEditAnnotations)
  return {
    canEditAnnotations,
    canViewAnnotations: Boolean(input.canViewAnnotations) || canEditAnnotations,
  }
}

export function buildAssemblyPermissionRows(
  assemblies: AssemblyResponse[],
  permissionsByAssemblyId: Partial<Record<string, AssemblyPermissionResponse>>,
): AssemblyPermissionRow[] {
  return assemblies.map((assembly) => {
    const permission = permissionsByAssemblyId[assembly._id]
    return {
      id: assembly._id,
      assemblyId: assembly._id,
      assemblyName: assembly.displayName ?? assembly.name,
      canViewAnnotations: permission?.canViewAnnotations ?? false,
      canEditAnnotations: permission?.canEditAnnotations ?? false,
    }
  })
}
