import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { loadOidcProviders } from './oidc.config.js'

function getter(config: Record<string, string>) {
  return (key: string) => config[key]
}

describe('loadOidcProviders', () => {
  it('returns no providers when nothing is configured', () => {
    expect(loadOidcProviders(getter({}))).toEqual([])
  })

  it('configures Google and Microsoft presets', () => {
    const providers = loadOidcProviders(
      getter({
        GOOGLE_CLIENT_ID: 'gid',
        GOOGLE_CLIENT_SECRET: 'gsecret',
        MICROSOFT_CLIENT_ID: 'mid',
        MICROSOFT_CLIENT_SECRET: 'msecret',
      }),
    )
    expect(providers).toEqual([
      {
        name: 'google',
        displayName: 'Google',
        issuer: 'https://accounts.google.com',
        clientId: 'gid',
        clientSecret: 'gsecret',
        scopes: 'openid email profile',
      },
      {
        name: 'microsoft',
        displayName: 'Microsoft',
        issuer: 'https://login.microsoftonline.com/common/v2.0',
        clientId: 'mid',
        clientSecret: 'msecret',
        scopes: 'openid email profile',
      },
    ])
  })

  it('uses MICROSOFT_TENANT in the Microsoft issuer', () => {
    const [provider] = loadOidcProviders(
      getter({
        MICROSOFT_CLIENT_ID: 'mid',
        MICROSOFT_CLIENT_SECRET: 'msecret',
        MICROSOFT_TENANT: 'organizations',
      }),
    )
    expect(provider?.issuer).toBe(
      'https://login.microsoftonline.com/organizations/v2.0',
    )
  })

  it('reads client IDs and secrets from files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oidc-config-'))
    const idFile = path.join(dir, 'id')
    const secretFile = path.join(dir, 'secret')
    fs.writeFileSync(idFile, 'file-id\n')
    fs.writeFileSync(secretFile, 'file-secret\n')
    try {
      const [provider] = loadOidcProviders(
        getter({
          OIDC_PROVIDERS: 'keycloak',
          OIDC_KEYCLOAK_ISSUER: 'https://sso.example.org/realms/apollo',
          OIDC_KEYCLOAK_CLIENT_ID_FILE: idFile,
          OIDC_KEYCLOAK_CLIENT_SECRET_FILE: secretFile,
        }),
      )
      expect(provider?.clientId).toBe('file-id')
      expect(provider?.clientSecret).toBe('file-secret')
    } finally {
      fs.rmSync(dir, { recursive: true })
    }
  })

  it('configures generic providers from OIDC_PROVIDERS', () => {
    const providers = loadOidcProviders(
      getter({
        OIDC_PROVIDERS: 'Keycloak, okta',
        OIDC_KEYCLOAK_ISSUER: 'https://sso.example.org/realms/apollo',
        OIDC_KEYCLOAK_CLIENT_ID: 'kid',
        OIDC_KEYCLOAK_CLIENT_SECRET: 'ksecret',
        OIDC_KEYCLOAK_DISPLAY_NAME: 'University SSO',
        OIDC_OKTA_ISSUER: 'https://example.okta.com',
        OIDC_OKTA_CLIENT_ID: 'oid',
        OIDC_OKTA_CLIENT_SECRET: 'osecret',
        OIDC_OKTA_SCOPES: 'openid email',
      }),
    )
    expect(providers).toEqual([
      {
        name: 'keycloak',
        displayName: 'University SSO',
        issuer: 'https://sso.example.org/realms/apollo',
        clientId: 'kid',
        clientSecret: 'ksecret',
        scopes: 'openid email profile',
      },
      {
        name: 'okta',
        displayName: 'okta',
        issuer: 'https://example.okta.com',
        clientId: 'oid',
        clientSecret: 'osecret',
        scopes: 'openid email',
      },
    ])
  })

  it('throws when a client secret is missing', () => {
    expect(() =>
      loadOidcProviders(getter({ GOOGLE_CLIENT_ID: 'gid' })),
    ).toThrow(/GOOGLE_CLIENT_SECRET/)
  })

  it('throws when a listed provider is missing its issuer or client ID', () => {
    expect(() =>
      loadOidcProviders(getter({ OIDC_PROVIDERS: 'keycloak' })),
    ).toThrow(/OIDC_KEYCLOAK_ISSUER/)
    expect(() =>
      loadOidcProviders(
        getter({
          OIDC_PROVIDERS: 'keycloak',
          OIDC_KEYCLOAK_ISSUER: 'https://sso.example.org',
        }),
      ),
    ).toThrow(/OIDC_KEYCLOAK_CLIENT_ID/)
  })

  it('throws on reserved, invalid, or duplicate provider names', () => {
    expect(() =>
      loadOidcProviders(getter({ OIDC_PROVIDERS: 'guest' })),
    ).toThrow(/reserved/)
    expect(() =>
      loadOidcProviders(getter({ OIDC_PROVIDERS: 'my-sso' })),
    ).toThrow(/Invalid/)
    expect(() =>
      loadOidcProviders(
        getter({
          GOOGLE_CLIENT_ID: 'gid',
          GOOGLE_CLIENT_SECRET: 'gsecret',
          OIDC_PROVIDERS: 'google',
        }),
      ),
    ).toThrow(/more than once/)
  })
})
