/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as fs from 'node:fs'

import { Flags } from '@oclif/core'
import { fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  localhostToAddress,
  wrapLines,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Edit features using an appropiate json input'
  static description = wrapLines(
    `Edit a feature by submitting a json input with all the required attributes for Apollo to process it. This is a very low level command which most users probably do not need.

    Input may be a json string or a json file and it may be an array of changes. This is an example input for editing feature type:

    {
      "typeName": "TypeChange",
      "changedIds": [
        "6613f7d22c957525d631b1cc"
      ],
      "assembly": "6613f7d1360321540a11e5ed",
      "featureId": "6613f7d22c957525d631b1cc",
      "oldType": "BAC",
      "newType": "G_quartet"
    }`,
  )

  static examples = [
    {
      description: 'Editing by passing a json to stdin:',
      command:
        'echo \'{"typeName": ... "newType": "G_quartet"}\' | <%= config.bin %> <%= command.id %> -j -',
    },
  ]

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

    let json = JSON.parse(jsonStr)
    if (!Array.isArray(json)) {
      json = [json]
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
      const response = await fetch(url, auth)
      if (!response.ok) {
        const errorMessage = await createFetchErrorMessage(
          response,
          'edit failed',
        )
        throw new Error(errorMessage)
      }
    }
    this.exit(0)
  }
}
