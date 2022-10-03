/**
 * Possible pre-defined user roles
 */
export enum Role {
  Admin = <any>'admin',
  ReadOnly = <any>'readOnly',
  User = <any>'user',
}

export const RoleNames = 'admin' || 'readOnly' || 'user'

// Define role inheritance
export const RoleInheritance = {
  readOnly: [Role.ReadOnly],
  user: [Role.ReadOnly, Role.User],
  admin: [Role.ReadOnly, Role.User, Role.Admin],
}
