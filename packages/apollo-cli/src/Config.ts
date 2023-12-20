import fs from 'node:fs'

import YAML from 'yaml'

import { ConfigError } from './utils.js'

class AccessToken {
  google?: string
  microsoft?: string

  constructor() {
    this.google = undefined
    this.microsoft = undefined
  }
}

class UserCredentials {
  username?: string
  password?: string

  constructor() {
    this.password = undefined
    this.username = undefined
  }
}

class Login {
  address?: string
  accessToken?: AccessToken
  userCredentials?: UserCredentials

  constructor(configFile?: string) {
    this.address = undefined
    this.userCredentials = new UserCredentials()
    this.accessToken = new AccessToken()
    if (configFile) {
      const doc = new YAML.Document(
        YAML.parseDocument(fs.readFileSync(configFile, 'utf8')).get('login'),
      )
      if (doc) {
        if (doc.get('address')) {
          this.address = doc.get('address') as string
        }
        for (const key of ['userCredentials', 'accessToken']) {
          const yml = new YAML.Document(doc.get(key))
          if (yml) {
            type t = keyof typeof this
            const slot = this[key as keyof t]
            for (const k of Object.keys(slot)) {
              if (yml.get(k)) {
                slot[k] = yml.get(k)
              }
            }
          }
        }
      }
    }
  }
}

export class Config {
  private doc = new YAML.Document()
  private validKeys = {
    login: Object.keys(new Login()),
    userCredentials: Object.keys(new UserCredentials()),
    accessToken: Object.keys(new AccessToken()),
  }

  constructor(private configFile: string) {
    let xlogin = new Login()
    if (fs.existsSync(configFile)) {
      xlogin = new Login(configFile)
    }
    this.doc = new YAML.Document({ login: xlogin })
  }

  private getNode(key: string): YAML.Document | undefined {
    let res = undefined
    if (this.validKeys.login.includes(key)) {
      res = new YAML.Document(this.doc.get('login'))
    } else if (this.validKeys.userCredentials.includes(key)) {
      res = new YAML.Document(
        new YAML.Document(this.doc.get('login')).get('userCredentials'),
      )
    } else if (this.validKeys.accessToken.includes(key)) {
      res = new YAML.Document(
        new YAML.Document(this.doc.get('login')).get('accessToken'),
      )
    } else {
      throw new ConfigError(`"${key}" is not a valid configuration key`)
    }
    return res
  }

  public get(key: string): string {
    const doc = this.getNode(key)
    const value: string = YAML.stringify(doc?.get(key))
    return value ? value.trim() : ''
  }

  public set(key: string, value: string) {
    const doc = this.getNode(key)
    doc?.set(key, value)
  }

  public writeConfigFile() {
    const yml = YAML.stringify(this.doc)
    fs.writeFileSync(this.configFile, yml)
  }

  public toString(): string {
    return YAML.stringify(this.doc)
  }
}
