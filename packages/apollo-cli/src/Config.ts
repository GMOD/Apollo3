import fs from 'node:fs'

import Joi from 'joi'
import YAML, { Schema } from 'yaml'

import { ConfigError } from './utils.ts'

interface RootCredentials {
  username?: string
  password?: string
}

interface Profile {
  address?: string
  accessType?: string
  rootCredentials?: RootCredentials
}

const KEYS = [
  'address',
  'accessType',
  'rootCredentials.username',
  'rootCredentials.password',
]

interface RecursiveObject {
  [key: number | string]: RecursiveObject | unknown
}

const profileSchema = Joi.object({
  address: Joi.string(),
  accessType: Joi.string(),
  rootCredentials: {
    username: Joi.string().allow(null, ''),
    password: Joi.string().allow(null, ''),
  }
})
const configSchema = Joi.object().pattern(/.*/, profileSchema)

export class Config {
  private profiles: Record<string, Profile | undefined> = {}

  constructor(private configFile: string) {
    if (fs.existsSync(configFile)) {
      const cfg = new YAML.Document(
        YAML.parseDocument(fs.readFileSync(configFile, 'utf8')),
      )
      const config = cfg.toJS()
      // validation if wanted
      const v = configSchema.validate(config)
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

  public get(key: string, profileName: string): string | undefined {
    this.checkKey(key)
    const profile = this.profiles[profileName] as RecursiveObject
    if (!profile) {
      // throw new Error(`No profile name "${profileName}" found`)
      return undefined
    }
    this.addProps(profile as RecursiveObject, key)
    const value = this.index(profile, key)
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      // The key is valid but missing from config
      return undefined
    }
    return value as unknown as string
  }

  public set<T extends keyof Profile>(
    key: string,
    value: string,
    profileName: string,
  ) {
    this.checkKey(key)
    let profile = this.profiles[profileName]
    if (!profile) {
      profile = {}
      this.profiles[profileName] = profile
    }
    this.addProps(profile as RecursiveObject, key, value)
  }

  public writeConfigFile() {
    const yml = YAML.stringify(this.profiles)
    fs.writeFileSync(this.configFile, yml)
  }

  public getProfileNames(): string[] {
    return Object.keys(this.profiles)
  }

  public toString(): string {
    return YAML.stringify(this.profiles)
  }
}
