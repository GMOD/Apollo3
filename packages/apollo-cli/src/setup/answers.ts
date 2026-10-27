import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { checkbox, confirm, input, password, select } from '@inquirer/prompts'
import Joi from 'joi'

import { validateAddress } from '../ApolloConf.js'

import { REPLACED_FILE_KEYS, parseEnv } from './env.js'
import {
  parseConfigFileList,
  readJBrowseVersion,
  validateConfigFiles,
  validateJBrowseDir,
} from './jbrowse.js'

/**
 * The first Apollo release whose collaboration server serves JBrowse itself
 * (JBROWSE_DIR) and supports the embedded MongoDB
 */
export const MINIMUM_APOLLO_VERSION = '3.0.0'

export const USER_ROLES = ['admin', 'user', 'readOnly'] as const
export type UserRole = (typeof USER_ROLES)[number]
export const NEW_USER_ROLES = [...USER_ROLES, 'none'] as const
export type NewUserRole = (typeof NEW_USER_ROLES)[number]
export const LOGIN_METHODS = ['root', 'guest', 'google', 'microsoft'] as const
export type LoginMethod = (typeof LOGIN_METHODS)[number]
export const MONGODB_TYPES = ['existing', 'embedded'] as const

const LOGIN_DOCS_URL =
  'https://apollo.jbrowse.org/docs/multi-user/installation/login-management'

export interface OAuthClient {
  clientId: string
  clientSecret: string
}

export interface SetupAnswers {
  installDir: string
  apolloVersion: string
  jbrowseDir: string
  jbrowseConfigFiles: string[]
  url: string
  port: number
  name: string
  description: string
  mongodb:
    | { type: 'existing'; uri: string }
    | { type: 'embedded'; dataDir: string }
  rootUser?: { password: string }
  guestUser?: { role: UserRole }
  google?: OAuthClient
  microsoft?: OAuthClient
  initialAdminEmail?: string
  defaultNewUserRole: NewUserRole
  uploadDir: string
  jwtSecret: string
  sessionSecret: string
}

/** Answers given on the command line instead of at a prompt */
export interface SetupFlags {
  'install-dir'?: string
  'apollo-version'?: string
  'jbrowse-dir'?: string
  'jbrowse-config-files'?: string
  url?: string
  port?: number
  name?: string
  description?: string
  mongodb?: string
  'mongodb-uri'?: string
  'mongodb-dir'?: string
  login?: string[]
  'root-password'?: string
  'guest-role'?: string
  'google-client-id'?: string
  'google-client-secret'?: string
  'microsoft-client-id'?: string
  'microsoft-client-secret'?: string
  'initial-admin-email'?: string
  'default-new-user-role'?: string
  'upload-dir'?: string
  yes: boolean
}

export interface GatheredAnswers {
  answers: SetupAnswers
  /** The `.env` of an earlier install in the same directory, if any */
  previousEnv: Map<string, string>
  isUpgrade: boolean
  rootPasswordGenerated: boolean
}

export function generateSecret(): string {
  return randomBytes(32).toString('base64url')
}

function versionParts(version: string): number[] {
  return version
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10))
}

/** Compare two `major.minor.patch` versions, ignoring any prerelease part */
export function compareVersions(a: string, b: string): number {
  const [aParts, bParts] = [versionParts(a), versionParts(b)]
  for (let i = 0; i < 3; i++) {
    const difference = (aParts[i] ?? 0) - (bParts[i] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

export function validateVersion(
  version: string,
  checkMinimum = true,
): string | undefined {
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
    return `"${version}" isn't a version number like ${MINIMUM_APOLLO_VERSION}`
  }
  if (checkMinimum && compareVersions(version, MINIMUM_APOLLO_VERSION) < 0) {
    return `apollo setup can only install Apollo ${MINIMUM_APOLLO_VERSION} or later`
  }
  return
}

export function validatePort(port: string): string | undefined {
  const number = Number(port)
  if (!Number.isInteger(number) || number < 1 || number > 65_535) {
    return 'Port must be a whole number from 1 to 65535'
  }
  return
}

export function validateMongoDBURI(uri: string): string | undefined {
  if (!/^mongodb(\+srv)?:\/\/./.test(uri)) {
    return 'MongoDB URI must start with "mongodb://" or "mongodb+srv://"'
  }
  return
}

export function validateEmail(email: string): string | undefined {
  if (!email) {
    return
  }
  return Joi.string().email().label('Email').validate(email).error?.message
}

export type InstallDirState =
  | { type: 'new' }
  | { type: 'existing'; env: Map<string, string> }

/**
 * An install directory must either be empty (or missing), or hold an earlier
 * install made by setup (it has `releases/`), which this run upgrades or
 * resumes. A first run that failed before writing `.env` counts as new.
 */
export async function inspectInstallDir(dir: string): Promise<InstallDirState> {
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { type: 'new' }
    }
    throw error
  }
  if (entries.length === 0) {
    return { type: 'new' }
  }
  if (entries.includes('releases')) {
    if (!entries.includes('.env')) {
      return { type: 'new' }
    }
    const envText = await fs.readFile(path.join(dir, '.env'), 'utf8')
    return { type: 'existing', env: parseEnv(envText) }
  }
  throw new Error(
    `"${dir}" isn't empty and wasn't set up by \`apollo setup\`. Choose an ` +
      'empty or new directory.',
  )
}

type Validator = (
  value: string,
) => string | undefined | Promise<string | undefined>

interface AskOptions {
  flagName: string
  flagValue: string | undefined
  message: string
  default?: string
  validate?: Validator
  /** Whether an empty answer is allowed */
  optional?: boolean
  secret?: boolean
  /** How to show the answer once it's given, if not as typed */
  display?: (value: string) => string
}

interface SelectOptions<T extends string> {
  flagName: string
  flagValue: string | undefined
  message: string
  default: T
  choices: readonly { name: string; value: T }[]
}

/**
 * Asks each question, unless it was answered by a flag, or `--yes` was given
 * and the question has a default
 */
class Asker {
  constructor(private readonly yes: boolean) {}

  async ask(options: AskOptions): Promise<string> {
    const { flagName, flagValue, optional, secret } = options
    const validate: Validator = async (value) => {
      if (!value) {
        return optional ? undefined : 'A value is required'
      }
      return options.validate?.(value)
    }
    const given = flagValue ?? (this.yes ? options.default : undefined)
    if (given !== undefined || (this.yes && optional)) {
      const value = (given ?? '').trim()
      const error = await validate(value)
      if (error) {
        throw new Error(`--${flagName}: ${error}`)
      }
      return value
    }
    if (this.yes) {
      throw new Error(`--${flagName} is required with --yes`)
    }
    const promptValidate = async (value: string) =>
      (await validate(value.trim())) ?? true
    const answer = secret
      ? await password({
          message: options.message,
          mask: true,
          validate: promptValidate,
        })
      : await input({
          message: options.message,
          default: options.default,
          validate: promptValidate,
          transformer: (value, { isFinal }) =>
            isFinal && options.display ? options.display(value.trim()) : value,
        })
    return answer.trim()
  }

  /** Asks for a directory, showing the answer as a full path */
  async askDirectory(options: AskOptions): Promise<string> {
    const answer = await this.ask({ ...options, display: resolveDir })
    return resolveDir(answer)
  }

  async select<T extends string>(options: SelectOptions<T>): Promise<T> {
    const { flagName, flagValue, choices } = options
    if (flagValue !== undefined) {
      const choice = choices.find((c) => c.value === flagValue)
      if (!choice) {
        throw new Error(
          `--${flagName} must be one of: ${choices.map((c) => c.value).join(', ')}`,
        )
      }
      return choice.value
    }
    if (this.yes) {
      return options.default
    }
    return select({
      message: options.message,
      choices,
      default: options.default,
    })
  }

  async confirm(message: string, defaultValue = true): Promise<boolean> {
    if (this.yes) {
      return true
    }
    return confirm({ message, default: defaultValue })
  }

  async checkbox<T extends string>(
    flagValue: T[] | undefined,
    message: string,
    choices: readonly { name: string; value: T; checked: boolean }[],
  ): Promise<T[]> {
    if (flagValue !== undefined) {
      return flagValue
    }
    if (this.yes) {
      return choices.filter((c) => c.checked).map((c) => c.value)
    }
    return checkbox({ message, choices })
  }
}

/**
 * Resolve a directory to an absolute path, expanding a leading `~` to the home
 * directory like a shell would, since prompts and quoted flags don't
 */
export function resolveDir(dir: string): string {
  if (dir === '~' || /^~[/\\]/.test(dir)) {
    return path.resolve(os.homedir(), dir.slice(2))
  }
  return path.resolve(dir)
}

/**
 * Work out every setup answer, from flags, from an earlier install's `.env`,
 * from defaults (with --yes), or by asking
 */
export async function gatherAnswers(
  flags: SetupFlags,
  options: {
    defaultVersion: string
    checkMinimumVersion: boolean
    log: (message: string) => void
  },
): Promise<GatheredAnswers> {
  const { log } = options
  const asker = new Asker(flags.yes)

  const installDir = await asker.askDirectory({
    flagName: 'install-dir',
    flagValue: flags['install-dir'],
    message: 'Install directory:',
    default: './apollo',
  })
  const installState = await inspectInstallDir(installDir)
  const previousEnv =
    installState.type === 'existing'
      ? installState.env
      : new Map<string, string>()
  // Treat empty values in the earlier .env as unset
  const previous = (key: string) => {
    const value = previousEnv.get(key)
    return value === '' ? undefined : value
  }
  if (installState.type === 'existing') {
    log(
      'Found an earlier Apollo install here. Its settings are the defaults, and ' +
        'its secrets are kept.',
    )
    const replaced = REPLACED_FILE_KEYS.filter((key) => previousEnv.has(key))
    if (replaced.length > 0) {
      log(
        `Warning: setup writes these values to .env directly, so it removes ${replaced.join(', ')}`,
      )
    }
  }

  const apolloVersion = await asker.ask({
    flagName: 'apollo-version',
    flagValue: flags['apollo-version'],
    message: 'Apollo version to install:',
    default: options.defaultVersion,
    validate: (value) => validateVersion(value, options.checkMinimumVersion),
  })

  const jbrowseDir = await asker.askDirectory({
    flagName: 'jbrowse-dir',
    flagValue: flags['jbrowse-dir'],
    message: 'Existing JBrowse Web directory:',
    default: previous('JBROWSE_DIR'),
    validate: (value) => validateJBrowseDir(resolveDir(value)),
  })
  log(`Found JBrowse ${await readJBrowseVersion(jbrowseDir)}`)

  let defaultConfigFiles = previous('JBROWSE_CONFIG_FILES')
  if (
    !defaultConfigFiles &&
    !(await validateConfigFiles(jbrowseDir, ['config.json']))
  ) {
    defaultConfigFiles = 'config.json'
  }
  const jbrowseConfigFiles = parseConfigFileList(
    await asker.ask({
      flagName: 'jbrowse-config-files',
      flagValue: flags['jbrowse-config-files'],
      message:
        'JBrowse config file(s), relative to the JBrowse directory and comma-separated:',
      default: defaultConfigFiles,
      validate: (value) =>
        validateConfigFiles(jbrowseDir, parseConfigFileList(value)),
    }),
  )

  const url = await asker.ask({
    flagName: 'url',
    flagValue: flags.url,
    message: 'Public URL users will open Apollo at:',
    default: previous('URL') ?? 'http://localhost:3999',
    validate: validateAddress,
  })
  const port = Number(
    await asker.ask({
      flagName: 'port',
      flagValue: flags.port === undefined ? undefined : String(flags.port),
      message: 'Port for the server to listen on:',
      default: previous('PORT') ?? '3999',
      validate: validatePort,
    }),
  )
  const name = await asker.ask({
    flagName: 'name',
    flagValue: flags.name,
    message: 'Server name:',
    default: previous('NAME') ?? 'Apollo',
  })
  const description = await asker.ask({
    flagName: 'description',
    flagValue: flags.description,
    message: 'Server description (optional):',
    default: previous('DESCRIPTION'),
    optional: true,
  })

  const mongodbType = await asker.select({
    flagName: 'mongodb',
    flagValue: flags.mongodb,
    message: 'MongoDB:',
    default: previous('MONGODB_EMBEDDED_DIR') ? 'embedded' : 'existing',
    choices: [
      { name: 'I have a MongoDB server', value: 'existing' },
      {
        name: 'Use embedded MongoDB (small or evaluation installs)',
        value: 'embedded',
      },
    ],
  })
  let mongodb: SetupAnswers['mongodb']
  if (mongodbType === 'existing') {
    const uri = await asker.ask({
      flagName: 'mongodb-uri',
      flagValue: flags['mongodb-uri'],
      message: 'MongoDB URI:',
      default: previous('MONGODB_URI') ?? 'mongodb://localhost:27017/apolloDb',
      validate: validateMongoDBURI,
    })
    mongodb = { type: 'existing', uri }
  } else {
    const dataDir = await asker.askDirectory({
      flagName: 'mongodb-dir',
      flagValue: flags['mongodb-dir'],
      message: 'Directory for the embedded MongoDB data:',
      default:
        previous('MONGODB_EMBEDDED_DIR') ??
        path.join(installDir, 'data', 'mongodb'),
    })
    log(
      'The embedded MongoDB is meant for trying out Apollo and for small ' +
        'installs, not for production. Setup downloads a MongoDB binary ' +
        '(about 100 MB) for it.',
    )
    if (
      flags.mongodb === undefined &&
      !(await asker.confirm('Use the embedded MongoDB?'))
    ) {
      throw new Error(
        'Setup cancelled. Run it again and choose an existing MongoDB server.',
      )
    }
    mongodb = { type: 'embedded', dataDir }
  }

  const loginMethods = await asker.checkbox(
    flags.login as LoginMethod[] | undefined,
    'Login methods:',
    [
      {
        name: 'Root user (password login, for admins and the CLI)',
        value: 'root',
        checked:
          installState.type === 'new' || previous('ALLOW_ROOT_USER') === 'true',
      },
      {
        name: 'Guest user (no login needed)',
        value: 'guest',
        checked:
          installState.type === 'new' ||
          previous('ALLOW_GUEST_USER') === 'true',
      },
      {
        name: 'Google',
        value: 'google',
        checked: Boolean(previous('GOOGLE_CLIENT_ID')),
      },
      {
        name: 'Microsoft',
        value: 'microsoft',
        checked: Boolean(previous('MICROSOFT_CLIENT_ID')),
      },
    ],
  )
  log(`For other OpenID Connect providers, see ${LOGIN_DOCS_URL}`)

  let rootUser: SetupAnswers['rootUser']
  let rootPasswordGenerated = false
  if (loginMethods.includes('root')) {
    const previousPassword = previous('ROOT_USER_PASSWORD')
    let rootPassword = await asker.ask({
      flagName: 'root-password',
      flagValue: flags['root-password'],
      message: previousPassword
        ? 'Root user password (leave blank to keep the current one):'
        : 'Root user password (leave blank to generate one):',
      default: previousPassword,
      optional: true,
      secret: true,
    })
    if (!rootPassword && previousPassword) {
      rootPassword = previousPassword
    }
    if (!rootPassword) {
      rootPassword = randomBytes(12).toString('base64url')
      rootPasswordGenerated = true
    }
    rootUser = { password: rootPassword }
  }

  let guestUser: SetupAnswers['guestUser']
  if (loginMethods.includes('guest')) {
    const role = await asker.select({
      flagName: 'guest-role',
      flagValue: flags['guest-role'],
      message: 'Role for the guest user:',
      default:
        (previous('GUEST_USER_ROLE') as UserRole | undefined) ?? 'readOnly',
      choices: USER_ROLES.map((value) => ({ name: value, value })),
    })
    guestUser = { role }
  }

  const askOAuthClient = async (
    provider: 'google' | 'microsoft',
    label: string,
  ): Promise<OAuthClient> => {
    const envPrefix = provider.toUpperCase()
    log(
      `Register this redirect URI with ${label}: ${new URL(`auth/${provider}`, url.endsWith('/') ? url : `${url}/`).href}`,
    )
    const clientId = await asker.ask({
      flagName: `${provider}-client-id`,
      flagValue: flags[`${provider}-client-id`],
      message: `${label} client ID:`,
      default: previous(`${envPrefix}_CLIENT_ID`),
    })
    const previousSecret = previous(`${envPrefix}_CLIENT_SECRET`)
    const clientSecret = await asker.ask({
      flagName: `${provider}-client-secret`,
      flagValue: flags[`${provider}-client-secret`],
      message: previousSecret
        ? `${label} client secret (leave blank to keep the current one):`
        : `${label} client secret:`,
      default: previousSecret,
      optional: Boolean(previousSecret),
      secret: true,
    })
    return { clientId, clientSecret: clientSecret || (previousSecret ?? '') }
  }
  const google = loginMethods.includes('google')
    ? await askOAuthClient('google', 'Google')
    : undefined
  const microsoft = loginMethods.includes('microsoft')
    ? await askOAuthClient('microsoft', 'Microsoft')
    : undefined

  const initialAdminEmail = await asker.ask({
    flagName: 'initial-admin-email',
    flagValue: flags['initial-admin-email'],
    message:
      'Email of the first admin, who becomes admin on first login (optional):',
    default: previous('INITIAL_ADMIN_EMAIL'),
    validate: validateEmail,
    optional: true,
  })
  const defaultNewUserRole = await asker.select({
    flagName: 'default-new-user-role',
    flagValue: flags['default-new-user-role'],
    message: 'Role for new users when they first log in:',
    default:
      (previous('DEFAULT_NEW_USER_ROLE') as NewUserRole | undefined) ?? 'none',
    choices: NEW_USER_ROLES.map((value) => ({ name: value, value })),
  })

  const uploadDir = await asker.askDirectory({
    flagName: 'upload-dir',
    flagValue: flags['upload-dir'],
    message: 'Directory for uploaded files:',
    default: previous('FILE_UPLOAD_FOLDER') ?? path.join(installDir, 'uploads'),
  })

  return {
    answers: {
      installDir,
      apolloVersion,
      jbrowseDir,
      jbrowseConfigFiles,
      url,
      port,
      name,
      description,
      mongodb,
      rootUser,
      guestUser,
      google,
      microsoft,
      initialAdminEmail: initialAdminEmail || undefined,
      defaultNewUserRole,
      uploadDir,
      jwtSecret: previous('JWT_SECRET') ?? generateSecret(),
      sessionSecret: previous('SESSION_SECRET') ?? generateSecret(),
    },
    previousEnv,
    isUpgrade: installState.type === 'existing',
    rootPasswordGenerated,
  }
}
