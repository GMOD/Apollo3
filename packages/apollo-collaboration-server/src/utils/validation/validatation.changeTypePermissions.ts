import { Role } from '../role/role.enum.js'

export function getRequiredRoleForChange(changeName: string) {
  if (
    [
      'AddAssemblyFromFileChange',
      'AddAssemblyAndFeaturesFromFileChange',
      'AddFeaturesFromFileChange',
      'AddRefSeqAliasesChange',
      'DeleteAssemblyChange',
      'UserChange',
      'DeleteUserChange',
    ].includes(changeName)
  ) {
    return Role.Admin
  }
  return Role.User
}
