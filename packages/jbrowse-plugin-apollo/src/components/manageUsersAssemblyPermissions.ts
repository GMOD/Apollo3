export interface AssemblyResponse {
  _id: string
  name: string
  displayName?: string
  scientificName?: string
}

export interface AssemblyPermissionResponse {
  _id: string
  userId: string
  assemblyId: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

export interface AssemblyPermissionLike {
  assemblyId: string
  canViewAnnotations: boolean
  canEditAnnotations: boolean
}

export interface AssemblyPermissionRow {
  id: string
  assemblyId: string
  assemblyName: string
  genusSpecies: string
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
  permissionsByAssemblyId: Partial<Record<string, AssemblyPermissionLike>>,
): AssemblyPermissionRow[] {
  return assemblies.map((assembly) => {
    const permission = permissionsByAssemblyId[assembly._id]
    const scientificName =
      typeof assembly.scientificName === 'string'
        ? assembly.scientificName.trim()
        : ''
    return {
      id: assembly._id,
      assemblyId: assembly._id,
      assemblyName: assembly.displayName ?? assembly.name,
      genusSpecies: scientificName || 'Unknown',
      canViewAnnotations: permission?.canViewAnnotations ?? false,
      canEditAnnotations: permission?.canEditAnnotations ?? false,
    }
  })
}
