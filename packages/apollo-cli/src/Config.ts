/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import fs from 'node:fs'
import path from 'node:path'

import Joi from 'joi'
import YAML, { YAMLParseError } from 'yaml'

import { checkProfileExists, queryApollo } from './utils.js'

export class ConfigError extends Error {}

interface BaseProfile {
  address: string
  accessType: 'google' | 'microsoft' | 'guest'
  accessToken: string
}

interface RootProfile extends Omit<BaseProfile, 'accessType'> {
  accessType: 'root'
  rootCredentials: {
    username: string
    password: string
  }
}

export type Profile = BaseProfile | RootProfile

export enum KEYS {
  address = 'address',
  accessType = 'accessType',
  accessToken = 'accessToken',
  rootCredentials_username = 'rootCredentials.username',
  rootCredentials_password = 'rootCredentials.password',
}

function optionDocs(): { key: string; description: string }[] {
  const docs: { key: string; description: string }[] = []
  for (const v of Object.values(KEYS)) {
    switch (v) {
      case 'address': {
        docs.push({
          key: v,
          description: 'Address and port e.g http://localhost:3999',
        })
        break
      }
      case 'accessType': {
        docs.push({
          key: v,
          description:
            'How to access Apollo. accessType is typically one of: google, microsoft, guest, root. Allowed types depend on your Apollo setup',
        })
        break
      }
      case 'accessToken': {
        docs.push({
          key: v,
          description: 'Access token. Usually inserted by `apollo login`',
        })
        break
      }
      case 'rootCredentials.username': {
        docs.push({
          key: v,
          description:
            'Username of root account. Only set this for "root" access type',
        })
        break
      }
      case 'rootCredentials.password': {
        docs.push({
          key: v,
          description:
            'Password for root account. Only set this for "root" access type',
        })
        break
      }
      default: {
        throw new ConfigError(`Unexpected key: ${v}`)
      }
    }
  }
  return docs
}

export function optionDesc(): string[] {
  const docs: string[] = []
  for (const x of optionDocs()) {
    docs.push(`- ${x.key}:\n${x.description}`)
  }
  return docs
}

interface RecursiveObject {
  [key: number | string]: RecursiveObject | unknown
}

function isValidAddress(address: string): boolean {
  // const port: string | undefined = address.split(':').pop()
  // if (port === undefined || /^\d+$/.test(port) === false) {
  //   return false
  // }

  let url
  try {
    url = new URL(address)
  } catch {
    return false
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  return true
}

const profileSchema = Joi.object({
  address: Joi.string()
    .uri({ scheme: /https?/ })
    .required(),
  accessType: Joi.string()
    .valid('google', 'microsoft', 'root', 'guest')
    .required(),
  accessToken: Joi.string(),
  rootCredentials: Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
  }).when('accessType', {
    is: Joi.string().valid('root'),
    // eslint-disable-next-line unicorn/no-thenable
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
})
const configSchema = Joi.object().pattern(Joi.string(), profileSchema)

export class Config {
  private profiles: Record<string, Profile | undefined> = {}

  constructor(private configFile: string) {
    if (fs.existsSync(configFile)) {
      const data: string = fs.readFileSync(configFile, 'utf8').trim()
      if (data !== '') {
        let config
        try {
          config = YAML.parse(data)
        } catch (error) {
          if (error instanceof YAMLParseError) {
            process.stderr.write(
              'Error: Configuration file is probably invalid yaml format:\n',
            )
            process.stderr.write(error.message)
          } else if (error instanceof Error) {
            process.stderr.write('Unexpected error:')
            process.stderr.write(error.message)
          }
          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(1)
        }
        this.profiles = config
      }
    }
  }

  private index(
    obj: RecursiveObject,
    arr: string | string[],
    value?: string,
  ): object {
    if (typeof arr == 'string') {
      return this.index(obj, arr.split('.'), value)
    }
    if (arr.length == 1 && value !== undefined) {
      return (obj[arr[0]] = value) as unknown as RecursiveObject
    }
    if (arr.length === 0) {
      return obj
    }
    return this.index(obj[arr[0]] as RecursiveObject, arr.slice(1), value)
  }

  private addProps(
    obj: RecursiveObject,
    arr: string | string[],
    value?: string,
  ) {
    // credit https://stackoverflow.com/questions/17643965/how-to-automatically-add-properties-to-an-object-that-is-undefined
    if (typeof arr == 'string') {
      arr = arr.split('.')
    }
    obj[arr[0]] = obj[arr[0]] || {}
    const tmpObj = obj[arr[0]] as RecursiveObject
    if (arr.length > 1) {
      arr.shift()
      this.addProps(tmpObj, arr, value)
    } else if (value !== undefined) {
      obj[arr[0]] = value
    }
    return obj
  }

  private checkKey(key: string) {
    for (const x of Object.values(KEYS)) {
      if (x === key) {
        return
      }
    }
    throw new ConfigError(
      `Invalid configuration key: "${key}". Valid keys are:\n${Object.values(
        '\n',
      )}`,
    )
  }

  public get(key: string, profileName: string): string {
    this.checkKey(key)
    const profile = this.profiles[profileName] as unknown as RecursiveObject
    if (!profile) {
      // throw new Error(`No profile name "${profileName}" found`)
      return ''
    }
    this.addProps(profile, key)
    const value = this.index(profile, key)
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      // The key is valid but missing from config
      return ''
    }
    return value as unknown as string
  }

  public set(key: string, value: string, profileName: string) {
    this.checkKey(key)

    if (key === KEYS[KEYS.address] && !isValidAddress(value)) {
      throw new ConfigError(`"${value}" is not a valid value for "${key}"`)
    }

    const profile = this.profiles[profileName] ?? ({} as Profile)
    this.profiles[profileName] = profile

    this.addProps(profile as unknown as RecursiveObject, key, value)
  }

  public writeConfigFile() {
    const yml = YAML.stringify(this.profiles)
    fs.mkdirSync(path.dirname(this.configFile), { recursive: true })
    fs.writeFileSync(this.configFile, yml)
  }

  public getProfileNames(): string[] {
    return Object.keys(this.profiles)
  }

  public validate(): Joi.ValidationResult {
    return configSchema.validate(this.profiles)
  }

  public async getAccess(profileName: string) {
    checkProfileExists(profileName, this)

    const address: string = this.get('address', profileName)
    if (address === undefined || address.trim() === '') {
      throw new ConfigError(
        `Profile "${profileName}" has no address. Please run "apollo config" to set it up.`,
      )
    }

    const accessToken: string | undefined = this.get('accessToken', profileName)
    if (accessToken === undefined || accessToken.trim() === '') {
      throw new ConfigError(
        `Profile "${profileName}" has no access token. Please run "apollo login" to set it up.`,
      )
    }

    await queryApollo(address, accessToken, 'assemblies')
    return { address, accessToken }
  }

  public toString(): string {
    return YAML.stringify(this.profiles)
  }
}
