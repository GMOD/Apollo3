import * as crypto from 'node:crypto'
import EventEmitter from 'node:events'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Command } from '@oclif/core'

import { Config } from './Config.js'

const CONFIG_PATH = path.resolve(os.homedir(), '.clirc')
export const CLI_SERVER_ADDRESS = 'http://127.0.0.1:5657'
export const CLI_SERVER_ADDRESS_CALLBACK = `${CLI_SERVER_ADDRESS}/auth/callback`

export class ConfigError extends Error {}
export interface UserCredentials {
  accessToken: string
}

function checkConfigfileExists(configFile: string) {
  if (!fs.existsSync(configFile)) {
    throw new ConfigError(
      `Configuration file "${configFile}" does not exist. Please run "apollo config" first`,
    )
  }
}

function checkProfileExists(profileName: string, config: Config) {
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

async function checkAccess(
  address: string,
  accessToken: string,
): Promise<void> {
  const url = new URL(`${address}/assemblies`)
  const auth = {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }
  try {
    const response = await fetch(url, auth)
    console.log('HERE')
  } catch {
    console.log('THERE')
  }
  //   if (response.ok) {
  //   return
  // }
  // const msg = `Failed to access Apollo with the current address and/or access token\nThe server returned:\n${response.statusText}`
  // throw new ConfigError(msg)
}

export async function getAccess(
  configFile: string,
  profileName: string,
): Promise<{ address: string; accessToken: string }> {
  checkConfigfileExists(configFile)
  const config: Config = new Config(configFile)
  checkProfileExists(profileName, config)

  const address: string = config.get('address', profileName)
  if (address === undefined || address.trim() === '') {
    throw new ConfigError(
      `Profile ${profileName} has no address. Please run "apollo config" to set it up.`,
    )
  }
  const accessToken: string | undefined = config.get('accessToken', profileName)
  if (accessToken === undefined || accessToken.trim() === '') {
    throw new ConfigError(
      `Profile ${profileName} has no access token. Please run "apollo login" to set it up.`,
    )
  }
  await checkAccess(address, accessToken)
  return { address, accessToken }
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
