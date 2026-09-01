import * as fs from 'node:fs'

import type { SerializedRefSeqAliasesChange } from '@apollo-annotation/shared'
import { Args, Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'

export default class AddRefNameAlias extends BaseCommand<
  typeof AddRefNameAlias
> {
  static summary = 'Add reference name aliases from a file'
  static description =
    'Reference name aliasing is a process to make chromosomes that are named slightly differently but which refer to the same thing render properly. This command reads a file with reference name aliases and adds them to the database.'

  static examples = [
    {
      description: 'Add reference name aliases:',
      command: '<%= config.bin %> <%= command.id %> alias.txt -a myAssembly',
    },
  ]

  static args = {
    'input-file': Args.string({
      description: 'Input refname alias file',
      required: true,
    }),
  }

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Name for this assembly.',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(AddRefNameAlias)

    if (!fs.existsSync(args['input-file'])) {
      this.error(`File ${args['input-file']} does not exist`)
    }

    const filehandle = await fs.promises.open(args['input-file'])
    const fileContent = await filehandle.readFile({ encoding: 'utf8' })
    await filehandle.close()
    const lines = fileContent.split('\n')

    const refNameAliases = []
    for (const line of lines) {
      const [refName, ...aliases] = line.split('\t')
      refNameAliases.push({ refName, aliases })
    }

    const json = (await this.get('assemblies')) as object[]
    const assembly = json.find((x) => 'name' in x && x.name === flags.assembly)
    const assemblyId = assembly && '_id' in assembly ? assembly._id : undefined

    if (!assemblyId) {
      this.error(`Assembly ${flags.assembly} not found`)
    }

    const change: SerializedRefSeqAliasesChange = {
      typeName: 'AddRefSeqAliasesChange',
      assembly: assemblyId as string,
      refSeqAliases: refNameAliases,
    }

    await this.post('changes', JSON.stringify(change))
    this.log(
      `Reference name aliases added successfully to assembly ${flags.assembly}`,
    )
  }
}
