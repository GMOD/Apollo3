export enum Role {
  Admin = 'admin',
  User = 'user',
  ReadOnly = 'readOnly',
  None = 'none',
}

// Define role inheritance
export const RoleInheritance = {
  none: [Role.None],
  readOnly: [Role.None, Role.ReadOnly],
  user: [Role.None, Role.ReadOnly, Role.User],
  admin: [Role.None, Role.ReadOnly, Role.User, Role.Admin],
}
