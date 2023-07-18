import jwtDecode from 'jwt-decode'

export interface JWTPayload {
  username: string
  email: string
  role?: 'admin' | 'user' | 'readOnly'
  id: string
}

export interface DecodedJWT extends JWTPayload {
  iat: number
  exp: number
}

export function makeUserSessionId(userOrToken: DecodedJWT | string): string {
  const user =
    typeof userOrToken === 'string'
      ? (jwtDecode(userOrToken) as DecodedJWT)
      : userOrToken
  return `${user.id}-${user.iat}`
}

export function getDecodedToken(token: string): DecodedJWT {
  return jwtDecode(token) as DecodedJWT
}
