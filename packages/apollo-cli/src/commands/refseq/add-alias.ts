import * as fs from 'node:fs'

import { type SerializedRefSeqAliasesChange } from '@apollo-annotation/shared'
import { Args, Flags } from '@oclif/core'
import { Agent, type RequestInit, type Response, fetch } from 'undici'

import { ConfigError } from '../../ApolloConf.js'
import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  localhostToAddress,
  queryApollo,
} from '../../utils.js'

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

    const access = await this.getAccess()
    const filehandle = await fs.promises.open(args['input-file'])
    const fileContent = await filehandle.readFile({ encoding: 'utf8' })
    await filehandle.close()
    const lines = fileContent.split('\n')

    const refNameAliases = []
    for (const line of lines) {
      const [refName, ...aliases] = line.split('\t')
      refNameAliases.push({ refName, aliases })
    }

    const assemblies: Response = await queryApollo(
      access.address,
      access.accessToken,
      'assemblies',
    )
    const json = (await assemblies.json()) as object[]
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
        'Failed to add reference name aliases',
      )
      throw new ConfigError(errorMessage)
    }
    this.log(
      `Reference name aliases added successfully to assembly ${flags.assembly}`,
    )
  }
}
