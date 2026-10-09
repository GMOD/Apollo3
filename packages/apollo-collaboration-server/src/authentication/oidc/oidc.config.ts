import fs from 'node:fs'

export interface OidcProviderConfig {
  /** Login type name, also used in the callback path `/auth/<name>` */
  name: string
  /** Shown to users as "Sign in with <displayName>" */
  displayName: string
  issuer: string
  clientId: string
  clientSecret: string
  scopes: string
}

/** Login type names that are already used by other auth routes */
export const RESERVED_LOGIN_TYPES = new Set(['login', 'types', 'guest', 'root'])

const DEFAULT_SCOPES = 'openid email profile'

type GetConfigValue = (key: string) => string | undefined

/**
 * Read a config value that can be given either directly as `key` or as a path
 * to a file containing the value as `${key}_FILE`
 */
function getValueOrFile(get: GetConfigValue, key: string) {
  const value = get(key)
  if (value) {
    return value
  }
  const file = get(`${key}_FILE`)
  return file ? fs.readFileSync(file, 'utf8').trim() : undefined
}

function getCredentials(get: GetConfigValue, prefix: string) {
  const clientId = getValueOrFile(get, `${prefix}_CLIENT_ID`)
  if (!clientId) {
    return
  }
  const clientSecret = getValueOrFile(get, `${prefix}_CLIENT_SECRET`)
  if (!clientSecret) {
    throw new Error(
      `${prefix}_CLIENT_ID is configured, but neither ${prefix}_CLIENT_SECRET nor ${prefix}_CLIENT_SECRET_FILE is set`,
    )
  }
  return { clientId, clientSecret }
}

/**
 * Get the configured OIDC providers. Google and Microsoft are presets
 * configured with GOOGLE_* and MICROSOFT_* variables. Other providers are
 * listed by name in OIDC_PROVIDERS and configured with OIDC_<NAME>_* variables.
 */
export function loadOidcProviders(get: GetConfigValue): OidcProviderConfig[] {
  const providers: OidcProviderConfig[] = []

  const google = getCredentials(get, 'GOOGLE')
  if (google) {
    providers.push({
      name: 'google',
      displayName: 'Google',
      issuer: 'https://accounts.google.com',
      scopes: DEFAULT_SCOPES,
      ...google,
    })
  }

  const microsoft = getCredentials(get, 'MICROSOFT')
  if (microsoft) {
    const tenant = get('MICROSOFT_TENANT') ?? 'common'
    providers.push({
      name: 'microsoft',
      displayName: 'Microsoft',
      issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
      scopes: DEFAULT_SCOPES,
      ...microsoft,
    })
  }

  const providerNames = (get('OIDC_PROVIDERS') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  for (const providerName of providerNames) {
    const name = providerName.toLowerCase()
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw new Error(
        `Invalid OIDC provider name "${providerName}" in OIDC_PROVIDERS, only letters, numbers, and underscores are allowed`,
      )
    }
    if (RESERVED_LOGIN_TYPES.has(name)) {
      throw new Error(
        `OIDC provider name "${providerName}" in OIDC_PROVIDERS is reserved`,
      )
    }
    if (providers.some((provider) => provider.name === name)) {
      throw new Error(
        `OIDC provider "${providerName}" is configured more than once`,
      )
    }
    const prefix = `OIDC_${name.toUpperCase()}`
    const issuer = get(`${prefix}_ISSUER`)
    if (!issuer) {
      throw new Error(
        `OIDC provider "${providerName}" is listed in OIDC_PROVIDERS, but ${prefix}_ISSUER is not set`,
      )
    }
    const credentials = getCredentials(get, prefix)
    if (!credentials) {
      throw new Error(
        `OIDC provider "${providerName}" is listed in OIDC_PROVIDERS, but neither ${prefix}_CLIENT_ID nor ${prefix}_CLIENT_ID_FILE is set`,
      )
    }
    providers.push({
      name,
      displayName: get(`${prefix}_DISPLAY_NAME`) ?? providerName,
      issuer,
      scopes: get(`${prefix}_SCOPES`) ?? DEFAULT_SCOPES,
      ...credentials,
    })
  }

  return providers
}
