export enum Role {
  Admin = 'admin',
  ReadOnly = 'readOnly',
  User = 'user',
}

// Define role inheritance
export const RoleInheritance = {
  readOnly: [Role.ReadOnly],
  user: [Role.ReadOnly, Role.User],
  admin: [Role.ReadOnly, Role.User, Role.Admin],
}
