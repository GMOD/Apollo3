import * as fs from 'node:fs'

import type {
  JBrowseConfig,
  SerializedImportJBrowseConfigChange,
} from '@apollo-annotation/shared'
import { Args } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'

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

    const filehandle = await fs.promises.open(args.inputFile)
    const fileContent = await filehandle.readFile({ encoding: 'utf8' })
    await filehandle.close()

    const change: SerializedImportJBrowseConfigChange = {
      typeName: 'ImportJBrowseConfigChange',
      newJBrowseConfig: JSON.parse(fileContent) as JBrowseConfig,
    }

    await this.post('changes', JSON.stringify(change))
  }
}
