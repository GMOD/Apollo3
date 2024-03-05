import * as fs from 'node:fs'

import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { localhostToAddress } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Edit features using an appropiate json input'

  static flags = {
    'json-input': Flags.string({
      char: 'j',
      default: '-',
      description: 'Json string or json file or "-" to read json from stdin',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    let jsonStr = flags['json-input']
    if (flags['json-input'] === '-') {
      jsonStr = fs.readFileSync(process.stdin.fd).toString()
    } else if (fs.existsSync(flags['json-input'])) {
      jsonStr = fs.readFileSync(flags['json-input']).toString()
    }

    let json
    try {
      json = JSON.parse(jsonStr)
      if (!Array.isArray(json)) {
        json = [json]
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logToStderr(`Error parsing json input:\n${error.message}`)
        this.exit(1)
      } else {
        throw error
      }
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    for (const change of json) {
      const str = JSON.stringify(change)

      const url = new URL(localhostToAddress(`${access.address}/changes`))
      const auth = {
        method: 'POST',
        body: str,
        headers: {
          authorization: `Bearer ${access.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
      try {
        const response = await fetch(url, auth)
        this.logToStderr(response.statusText)
      } catch (error) {
        if (error instanceof Error) {
          this.logToStderr(error.message)
        }
        throw error
      }
    }
  }
}
