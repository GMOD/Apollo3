import path from 'node:path'

import type { SetupAnswers } from './answers.js'

const CONFIG_DOCS_URL =
  'https://apollo.jbrowse.org/docs/multi-user/installation/configuration-options'

/**
 * Keys that `apollo setup` manages. Anything else found in an existing `.env`
 * was added by the admin and is kept as-is when the file is rewritten.
 */
export const MANAGED_KEYS = new Set([
  'URL',
  'PORT',
  'NAME',
  'DESCRIPTION',
  'JBROWSE_DIR',
  'JBROWSE_CONFIG_FILES',
  'PLUGIN_LOCATION',
  'MONGODB_URI',
  'MONGODB_EMBEDDED_DIR',
  'MONGOMS_DOWNLOAD_DIR',
  'FILE_UPLOAD_FOLDER',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ALLOW_ROOT_USER',
  'ROOT_USER_PASSWORD',
  'ALLOW_GUEST_USER',
  'GUEST_USER_ROLE',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'INITIAL_ADMIN_EMAIL',
  'DEFAULT_NEW_USER_ROLE',
])

/**
 * `_FILE` variants of the managed keys. Setup writes the values themselves,
 * and the server refuses both forms at once, so these are dropped from an
 * existing `.env`.
 */
export const REPLACED_FILE_KEYS = [
  'MONGODB_URI_FILE',
  'JWT_SECRET_FILE',
  'SESSION_SECRET_FILE',
  'ROOT_USER_PASSWORD_FILE',
  'GOOGLE_CLIENT_ID_FILE',
  'GOOGLE_CLIENT_SECRET_FILE',
  'MICROSOFT_CLIENT_ID_FILE',
  'MICROSOFT_CLIENT_SECRET_FILE',
]
for (const key of REPLACED_FILE_KEYS) {
  MANAGED_KEYS.add(key)
}

/** Keys whose values are masked when the `.env` is printed */
export const SECRET_KEYS = new Set([
  'JWT_SECRET',
  'SESSION_SECRET',
  'ROOT_USER_PASSWORD',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_SECRET',
])

/** File name of the plugin bundle that setup adds to the JBrowse directory */
export function pluginFileName(apolloVersion: string): string {
  return `apollo-v${apolloVersion}.js`
}

export function mongoDBBinaryDir(installDir: string): string {
  return path.join(installDir, 'mongodb-binaries')
}

/** Quote a value so that dotenv reads it back unchanged */
export function quoteEnvValue(value: string): string {
  if (/^[\w./:@+,=-]*$/.test(value)) {
    return value
  }
  for (const quote of ["'", '"', '`']) {
    if (!value.includes(quote) && !value.includes('\n')) {
      return `${quote}${value}${quote}`
    }
  }
  throw new Error(`Can't write this value to a .env file: ${value}`)
}

/**
 * Parse the subset of dotenv syntax that `renderEnv` writes, plus plain
 * `KEY=value` lines an admin may have added by hand
 */
export function parseEnv(text: string): Map<string, string> {
  const env = new Map<string, string>()
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const match = /^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(line)
    if (!match) {
      continue
    }
    const [, key, rawValue] = match
    const quoted = /^(['"`])(.*)\1/.exec(rawValue)
    const value = quoted ? quoted[2] : rawValue.replace(/\s+#.*$/, '').trim()
    env.set(key, value)
  }
  return env
}

/**
 * Render the collaboration server's `.env` file. `extraEnv` holds settings
 * from an existing `.env` that setup doesn't manage, which are kept.
 */
export function renderEnv(
  answers: SetupAnswers,
  extraEnv = new Map<string, string>(),
): string {
  const lines = [
    '# Make sure to add new env variables to the docs page on the website',
    '# Written by `apollo setup`. Re-running setup keeps any settings added at the',
    '# end of this file. For all the available options, see',
    `# ${CONFIG_DOCS_URL}`,
    '',
  ]
  const add = (key: string, value: string | number | boolean) => {
    lines.push(`${key}=${quoteEnvValue(String(value))}`)
  }

  add('URL', answers.url)
  add('PORT', answers.port)
  add('NAME', answers.name)
  if (answers.description) {
    add('DESCRIPTION', answers.description)
  }

  lines.push('', '# JBrowse')
  add('JBROWSE_DIR', answers.jbrowseDir)
  add('JBROWSE_CONFIG_FILES', answers.jbrowseConfigFiles.join(','))
  add('PLUGIN_LOCATION', pluginFileName(answers.apolloVersion))

  lines.push('', '# MongoDB')
  if (answers.mongodb.type === 'existing') {
    add('MONGODB_URI', answers.mongodb.uri)
  } else {
    lines.push(
      '# Embedded MongoDB is meant for trying out Apollo, not production',
    )
    add('MONGODB_EMBEDDED_DIR', answers.mongodb.dataDir)
    add('MONGOMS_DOWNLOAD_DIR', mongoDBBinaryDir(answers.installDir))
  }

  lines.push('', '# Files and secrets')
  add('FILE_UPLOAD_FOLDER', answers.uploadDir)
  add('JWT_SECRET', answers.jwtSecret)
  add('SESSION_SECRET', answers.sessionSecret)

  lines.push('', '# Users and logins')
  if (answers.rootUser) {
    add('ALLOW_ROOT_USER', true)
    add('ROOT_USER_PASSWORD', answers.rootUser.password)
  }
  if (answers.guestUser) {
    add('ALLOW_GUEST_USER', true)
    add('GUEST_USER_ROLE', answers.guestUser.role)
  }
  if (answers.google) {
    add('GOOGLE_CLIENT_ID', answers.google.clientId)
    add('GOOGLE_CLIENT_SECRET', answers.google.clientSecret)
  }
  if (answers.microsoft) {
    add('MICROSOFT_CLIENT_ID', answers.microsoft.clientId)
    add('MICROSOFT_CLIENT_SECRET', answers.microsoft.clientSecret)
  }
  if (answers.initialAdminEmail) {
    add('INITIAL_ADMIN_EMAIL', answers.initialAdminEmail)
  }
  add('DEFAULT_NEW_USER_ROLE', answers.defaultNewUserRole)

  const extraKeys = [...extraEnv.keys()].filter((key) => !MANAGED_KEYS.has(key))
  if (extraKeys.length > 0) {
    lines.push('', '# Other settings, kept from the previous .env')
    for (const key of extraKeys) {
      add(key, extraEnv.get(key) ?? '')
    }
  }

  return `${lines.join('\n')}\n`
}

/** Replace secret values in a rendered `.env` with asterisks, for printing */
export function maskEnv(envText: string): string {
  return envText
    .split('\n')
    .map((line) => {
      const [key] = line.split('=', 1)
      return SECRET_KEYS.has(key) && line.includes('=')
        ? `${key}=********`
        : line
    })
    .join('\n')
}
