import * as fs from 'node:fs'
import { LoginError } from './utils'
import * as path from 'path'
import { homedir } from 'os'
const yaml = require('js-yaml');

export const DEFAULT_CONFIG_FILE: string = path.join(homedir(), '.config/apollo/config.yaml')

export class LoginConfig {
  username: string | undefined = undefined 
  password: string | undefined = undefined 
  address: string | undefined = undefined 
}

export class Config {
  public login: LoginConfig = new LoginConfig()

  constructor(configFile?: string) {
    if (configFile !== undefined) {
      this.readConfigFile(configFile)
    } else if (fs.existsSync(DEFAULT_CONFIG_FILE)) {
      this.readConfigFile(DEFAULT_CONFIG_FILE)
    }
  }

  // public get(key: string) {
  //   const keyLst: string[] = key.split('.')
    
  //   let nest = this
  //   for (const k in keyLst) {
  //     type ObjectKey = keyof typeof nest
  //     const myVar = k as ObjectKey
  //     console.log(nest[myVar])
  //     nest = nest[myVar]
  //   }
  // }

  private readConfigFile(configFile: string): void {
    let cfg = undefined
    try {
      cfg = yaml.load(fs.readFileSync(configFile, 'utf8'))
    } catch(error) {
      throw new LoginError(`Configuration file ${configFile} is malformed or not readable`)
    }
    
    const loginConfig: LoginConfig = new LoginConfig()
    if(Object.keys(cfg).includes('login')) {
      for (const key of Object.keys(loginConfig)) {
        if (cfg.login[key] !== undefined) {
          loginConfig[key as keyof LoginConfig] = String(cfg.login[key])
        }
      }
      this.login = loginConfig
    }
  }
}
    