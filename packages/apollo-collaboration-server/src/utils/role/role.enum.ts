/**
 * Possible pre-defined user roles
 */
export enum Role {
  Admin = 'admin',
  ReadOnly = 'readOnly',
  User = 'user',
}

export const RoleNames = 'admin' || 'readOnly' || 'user'

// Define role inheritance
export const RoleInheritance = {
  readOnly: [Role.ReadOnly],
  user: [Role.ReadOnly, Role.User],
  admin: [Role.ReadOnly, Role.User, Role.Admin],
}
