export const GUEST_USER_NAME = 'Guest'
// not a valid email, so shouldn't overlap with any regular users' emails
export const GUEST_USER_EMAIL = 'guest_user'
export const ROOT_USER_EMAIL = 'root_user'

export const AUTH_COOKIE_NAME = 'apollo_jwt'
// Keep in sync with JwtModule's signOptions.expiresIn ('1d') in authentication.module.ts
export const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000
