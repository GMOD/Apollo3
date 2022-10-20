export interface JWTPayload {
  username: string
  sub: number
  roles: ('admin' | 'user' | 'readOnly')[]
}
