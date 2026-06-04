import { Flags } from '@oclif/core'
import type { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { resolveAssemblyIds, resolveUserId } from '../../permissionsUtils.js'
import { queryApollo } from '../../utils.js'

export default class List extends BaseCommand<typeof List> {
  static summary = 'List assembly permissions'
  static description =
    'Lists assembly permission documents, optionally filtered by user and/or assembly.'

  static examples = [
    {
      description: 'List all permissions:',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'List permissions for one user:',
      command: '<%= config.bin %> <%= command.id %> -u user@example.org',
    },
    {
      description: 'List permissions for one assembly:',
      command: '<%= config.bin %> <%= command.id %> -a myAssembly',
    },
  ]

  static flags = {
    user: Flags.string({
      char: 'u',
      description: 'Filter by user id, username, or email',
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Filter by one assembly name or id',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(List)
    const access = await this.getAccess()

    let userId: string | undefined
    if (flags.user) {
      userId = await resolveUserId(
        access.address,
        access.accessToken,
        flags.user,
      )
    }

    let assemblyId: string | undefined
    if (flags.assembly) {
      const assemblyIds = await resolveAssemblyIds(
        access.address,
        access.accessToken,
        [flags.assembly],
      )
      if (assemblyIds.length > 1) {
        throw new Error(
          `Assembly '${flags.assembly}' resolved to multiple ids, use an id to disambiguate`,
        )
      }
      assemblyId = assemblyIds[0]
    }

    const queryParams = new URLSearchParams()
    if (userId) {
      queryParams.set('userId', userId)
    }
    if (assemblyId) {
      queryParams.set('assemblyId', assemblyId)
    }

    const endpoint = queryParams.size
      ? `assemblyPermissions?${queryParams.toString()}`
      : 'assemblyPermissions'

    const response: Response = await queryApollo(
      access.address,
      access.accessToken,
      endpoint,
    )
    const permissions = (await response.json()) as object[]
    this.log(JSON.stringify(permissions, null, 2))
  }
}
