import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { Command } from '@oclif/core'

const CONFIG_PATH = path.resolve(os.homedir(), '.clirc')

export interface UserCredentials {
  accessToken: string
}

export const getUserCredentials = (): UserCredentials | null => {
  try {
    const content = fs.readFileSync(CONFIG_PATH, { encoding: 'utf8' })

    return JSON.parse(content) as UserCredentials
  } catch {
    return null
  }
}

export default class AuthStatus extends Command {
  static description = 'View authentication status'

  public async run(): Promise<void> {
    const userCredentials = getUserCredentials()

    if (userCredentials) {
      this.log(`Logged in with token ${userCredentials.accessToken}`)
    } else {
      this.log("You're not logged in. Run `apollo login` to authenticate.")
    }
  }
}
