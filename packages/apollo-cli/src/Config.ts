import fs from 'node:fs'

import Joi from 'joi'
import YAML from 'yaml'

import { ConfigError } from './utils.ts'

interface BaseProfile {
  address: string
  accessType: 'google' | 'microsoft' | 'guest'
  accessToken: string
  token: string
}

interface RootProfile extends Omit<BaseProfile, 'accessType'> {
  accessType: 'root'
  rootCredentials: {
    username: string
    password: string
  }
}

export type Profile = BaseProfile | RootProfile

const KEYS = [
  'address',
  'accessType',
  'accessToken',
  'rootCredentials.username',
  'rootCredentials.password',
]

interface RecursiveObject {
  [key: number | string]: RecursiveObject | unknown
}

function isValidAddress(address: string): boolean {
  const port: string | undefined = address.split(':').pop()
  if (port === undefined || /^\d+$/.test(port) === false) {
    return false
  }

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
      const cfg = new YAML.Document(
        YAML.parseDocument(fs.readFileSync(configFile, 'utf8')),
      )
      const config = cfg.toJS()
      this.profiles = config
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
    return this.index(
      obj[arr[0]] as unknown as RecursiveObject,
      arr.slice(1),
      value,
    )
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
    if (!KEYS.includes(key)) {
      throw new ConfigError(
        `Invalid configuration key: "${key}". Valid keys are:\n${KEYS.join(
          '\n',
        )}`,
      )
    }
  }

  public get(key: string, profileName: string): string {
    this.checkKey(key)
    const profile = this.profiles[profileName] as unknown as RecursiveObject
    if (!profile) {
      // throw new Error(`No profile name "${profileName}" found`)
      return ''
    }
    this.addProps(profile as RecursiveObject, key)
    const value = this.index(profile, key)
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      // The key is valid but missing from config
      return ''
    }
    return value as unknown as string
  }

  public set<T extends keyof Profile>(
    key: string,
    value: string,
    profileName: string,
  ) {
    this.checkKey(key)

    if (key === 'address' && !isValidAddress(value)) {
      throw new ConfigError(`"${value}" is not a valid value for "${key}"`)
    }

    const profile = this.profiles[profileName] ?? ({} as Profile)
    this.profiles[profileName] = profile

    this.addProps(profile as unknown as RecursiveObject, key, value)
  }

  public writeConfigFile() {
    const yml = YAML.stringify(this.profiles)
    fs.writeFileSync(this.configFile, yml)
  }

  public getProfileNames(): string[] {
    return Object.keys(this.profiles)
  }

  public validate(): Joi.ValidationResult {
    return configSchema.validate(this.profiles)
  }

  public toString(): string {
    return YAML.stringify(this.profiles)
  }
}
