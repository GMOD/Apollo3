import fs from 'node:fs'
import path from 'node:path'

import Conf from 'conf'
import Joi from 'joi'
import YAML from 'yaml'

import { checkProfileExists, queryApollo } from './utils.js'

export class ConfigError extends Error {}

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

export class ApolloConf extends Conf {
  constructor(configFile: string) {
    let APOLLO_DISABLE_CONFIG_CREATE = false
    if (
      process.env.APOLLO_DISABLE_CONFIG_CREATE !== undefined &&
      process.env.APOLLO_DISABLE_CONFIG_CREATE !== '0'
    ) {
      APOLLO_DISABLE_CONFIG_CREATE = true
    }
    if (APOLLO_DISABLE_CONFIG_CREATE && !fs.existsSync(configFile)) {
      throw new ConfigError(
        'Configuration file does not exist yet, please create it as an empty file first.',
      )
    }
    super({
      projectName: 'apollo-cli',
      fileExtension: path.parse(configFile).ext.replace(/^\./, ''),
      configName: path.parse(configFile).name,
      cwd: path.dirname(configFile),
      serialize: YAML.stringify,
      deserialize: YAML.parse,
    })
    const v = configSchema.validate(this.store)
    if (v.error?.message !== undefined) {
      throw new Error(`Invalid setting: ${v.error.message}`)
    }
  }

  get store() {
    const superStore = super.store
    const v = configSchema.validate(superStore)
    if (v.error?.message !== undefined) {
      throw new ConfigError(`Invalid key: ${v.error.message}`)
    }
    return superStore
  }

  set store(newStore) {
    const v = configSchema.validate(newStore)
    if (v.error?.message !== undefined) {
      throw new ConfigError(`Invalid setting: ${v.error.message}`)
    }
    super.store = newStore
  }

  public getProfileNames(): string[] {
    return Object.keys(this.store)
  }

  public setAccessType(profileName: string, accessType: string) {
    if (accessType != 'root') {
      this.delete(`${profileName}.rootCredentials`)
    }
    this.set(`${profileName}.accessType`, accessType)
  }

  public async getAccess(profileName: string) {
    checkProfileExists(profileName, this)

    const address: string = this.get(`${profileName}.address`) as string
    if (address.trim() === '') {
      throw new ConfigError(
        `Profile "${profileName}" has no address. Please run "apollo config" to set it up.`,
      )
    }

    const accessToken: string = this.get(`${profileName}.accessToken`) as string
    if (accessToken.trim() === '') {
      throw new ConfigError(
        `Profile "${profileName}" has no access token. Please run "apollo login" to set it up.`,
      )
    }

    await queryApollo(address, accessToken, 'assemblies')
    return { address, accessToken }
  }
}

const profileSchema = Joi.object({
  address: Joi.string().uri({ scheme: /https?/ }),
  accessType: Joi.string().valid('google', 'microsoft', 'root', 'guest'),
  accessToken: Joi.string(),
  rootCredentials: Joi.object({
    username: Joi.string(),
    password: Joi.string(),
  }).when('accessType', {
    is: Joi.string().valid('root'),

    otherwise: Joi.forbidden(),
  }),
})
const configSchema = Joi.object().pattern(Joi.string(), profileSchema)
