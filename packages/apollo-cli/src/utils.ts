import { Config } from './Config.js'
import * as crypto from 'node:crypto'
import EventEmitter from 'node:events'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { config } from 'node:process'
import { CONFIG_FILE } from './test/fixtures.js'

const CONFIG_PATH = path.resolve(os.homedir(), '.clirc')
export const CLI_SERVER_ADDRESS = 'http://127.0.0.1:5657'
export const CLI_SERVER_ADDRESS_CALLBACK = `${CLI_SERVER_ADDRESS}/auth/callback`
export const KEYCLOAK_SERVER_ADDRESS = 'http://127.0.0.1:8080'

export class ConfigError extends Error {}
export interface UserCredentials {
  accessToken: string
}

function checkConfigfileExists(configFile: string) {
  if (!fs.existsSync(configFile)) {
    throw new ConfigError(`Configuration file ${configFile} does not exist. Please run "apollo config" first`)
  }
}

function checkProfileExists(profileName: string, config: Config) {
  if (!config.getProfileNames().includes(profileName)) {
    throw new ConfigError(`Profile ${profileName} does not exist. Please run "apollo config" to set this profile up or choose a different profile`)
  }
}

export function basicCheckConfig(configFile: string, profileName: string) {
  checkConfigfileExists(configFile)
  const config: Config = new Config(configFile)
  checkProfileExists(profileName, config)
}

// export const saveUserCredentials = (data: UserCredentials): void => {
//   fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), {
//     encoding: 'utf8',
//   })
// }

export const getUserCredentials = (): UserCredentials | null => {
  try {
    const content = fs.readFileSync(CONFIG_PATH, { encoding: 'utf8' })

    return JSON.parse(content) as UserCredentials
  } catch {
    return null
  }
}

export const generatePkceChallenge = (): {
  state: string
  codeVerifier: string
  codeChallenge: string
} => {
  const codeVerifier = crypto.randomBytes(64).toString('hex')

  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

  return {
    state: crypto.randomBytes(32).toString('hex'),
    codeVerifier,
    codeChallenge,
  }
}

export const waitFor = <T>(
  eventName: string,
  emitter: EventEmitter,
): Promise<T> => {
  const promise = new Promise<T>((resolve, reject) => {
    const handleEvent = (eventData: T): void => {
      eventData instanceof Error ? reject(eventData) : resolve(eventData)

      emitter.removeListener(eventName, handleEvent)
    }

    emitter.addListener(eventName, handleEvent)
  })

  return promise
}
