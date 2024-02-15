import * as crypto from 'node:crypto'
import EventEmitter from 'node:events'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Config, ConfigError } from './Config.js'

const CONFIG_PATH = path.resolve(os.homedir(), '.clirc')
export const CLI_SERVER_ADDRESS = 'http://127.0.0.1:5657'
export const CLI_SERVER_ADDRESS_CALLBACK = `${CLI_SERVER_ADDRESS}/auth/callback`
export interface UserCredentials {
  accessToken: string
}

export function checkConfigfileExists(configFile: string) {
  if (!fs.existsSync(configFile)) {
    throw new ConfigError(
      `Configuration file "${configFile}" does not exist. Please run "apollo config" first`,
    )
  }
}

export function checkProfileExists(profileName: string, config: Config) {
  if (!config.getProfileNames().includes(profileName)) {
    throw new ConfigError(
      `Profile "${profileName}" does not exist. Please run "apollo config" to set this profile up or choose a different profile`,
    )
  }
}

export function basicCheckConfig(configFile: string, profileName: string) {
  checkConfigfileExists(configFile)
  const config: Config = new Config(configFile)
  checkProfileExists(profileName, config)
}

/**
 * @deprecated Use this function while we wait to resolve the TypeError when using localhost in fetch.
 */
export function localhostToAddress(url: string) {
  /** This is hacked function that should become redundant: On my MacOS (?)
   * localhost must be converted to address otherwise fetch throws TypeError
   * */
  return url.replace('//localhost', '127.0.0.1')
}

export async function queryApollo(
  address: string,
  accessToken: string,
  endpoint: string,
): Promise<Response> {
  const auth = {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  const url = new URL(localhostToAddress(`${address}/${endpoint}`))
  const response = await fetch(url, auth)
  if (response.ok) {
    return response
  }
  const msg = `Failed to access Apollo with the current address and/or access token\nThe server returned:\n${response.statusText}`
  throw new ConfigError(msg)
}

export function filterJsonList(
  json: object[],
  keep: string[],
  key: string,
): object[] {
  const unique = new Set(keep)
  const results: object[] = []
  for (const x of json) {
    if (Object.keys(x).includes(key) && unique.has(x[key as keyof typeof x])) {
      results.push(x)
    }
  }
  return results
}

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
