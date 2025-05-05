import * as fs from 'node:fs'

import {
  type JBrowseConfig,
  type SerializedImportJBrowseConfigChange,
} from '@apollo-annotation/shared'
import { Args } from '@oclif/core'
import { Agent, RequestInit, fetch } from 'undici'

import { ConfigError } from '../../ApolloConf.js'
import { BaseCommand } from '../../baseCommand.js'
import { createFetchErrorMessage, localhostToAddress } from '../../utils.js'

export default class SetConfig extends BaseCommand<typeof SetConfig> {
  static summary = 'Set JBrowse configuration'
  static description =
    'Set JBrowse configuration in Apollo collaboration server'

  static examples = [
    {
      description: 'Add JBrowse configuration:',
      command: '<%= config.bin %> <%= command.id %> config.json',
    },
  ]

  static args = {
    inputFile: Args.string({
      description: 'JBrowse configuration file',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args } = await this.parse(SetConfig)

    if (!fs.existsSync(args.inputFile)) {
      this.error(`File ${args.inputFile} does not exist`)
    }

    const access = await this.getAccess()
    const filehandle = await fs.promises.open(args.inputFile)
    const fileContent = await filehandle.readFile({ encoding: 'utf8' })
    await filehandle.close()

    const change: SerializedImportJBrowseConfigChange = {
      typeName: 'ImportJBrowseConfigChange',
      newJBrowseConfig: JSON.parse(fileContent) as JBrowseConfig,
    }

    const auth: RequestInit = {
      method: 'POST',
      body: JSON.stringify(change),
      headers: {
        Authorization: `Bearer ${access.accessToken}`,
        'Content-Type': 'application/json',
      },
      dispatcher: new Agent({ headersTimeout: 60 * 60 * 1000 }),
    }
    const url = new URL(localhostToAddress(`${access.address}/changes`))
    const response = await fetch(url, auth)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'Failed to add JBrowse configuration',
      )
      throw new ConfigError(errorMessage)
    }
  }
}
