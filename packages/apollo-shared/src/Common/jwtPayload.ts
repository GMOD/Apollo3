export interface JWTPayload {
  username: string
  email: string
  roles: ('admin' | 'user' | 'readOnly')[]
}
