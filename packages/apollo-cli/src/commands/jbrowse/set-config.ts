import * as fs from 'node:fs'
import {
  type JBrowseConfig,
  type SerializedImportJBrowseConfigChange,
} from '@apollo-annotation/shared'
import { Args } from '@oclif/core'
import { Agent, RequestInit, fetch } from 'undici'
import { ConfigError } from '../../ApolloConf.js'
import { BaseCommand } from '../../baseCommand.js'
import {
  wrapLines,
  localhostToAddress,
  createFetchErrorMessage,
} from '../../utils.js'

export default class SetConfig extends BaseCommand<typeof SetConfig> {
  static summary = 'Add jbrowse configuration'
  static description = wrapLines(
    'Add jbrowse configuration into apollo database',
  )

  static examples = [
    {
      description: 'Add jbrowse configuration:',
      command: '<%= config.bin %> <%= command.id %> config.json',
    },
  ]

  static args = {
    inputFile: Args.string({
      description: 'Input jbrowse configuration file',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SetConfig)

    if (!fs.existsSync(args.inputFile)) {
      this.error(`File ${args.inputFile} does not exist`)
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)
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
        'Failed to add jbrowse configuration',
      )
      throw new ConfigError(errorMessage)
    }
    this.log('Jbrowse configuartion added successfully to apollo')
  }
}
