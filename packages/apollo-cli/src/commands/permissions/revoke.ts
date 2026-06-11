import { Flags } from '@oclif/core'
import { type RequestInit, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { resolveAssemblyIds, resolveUserId } from '../../permissionsUtils.js'
import { createFetchErrorMessage, localhostToAddress } from '../../utils.js'

export default class Revoke extends BaseCommand<typeof Revoke> {
  static summary = 'Revoke assembly permissions from a user'
  static description =
    'Revokes annotation permissions for one user across one or more assemblies.'

  static examples = [
    {
      description: 'Revoke access from one assembly:',
      command:
        '<%= config.bin %> <%= command.id %> -u user@example.org -a myAssembly',
    },
  ]

  static flags = {
    user: Flags.string({
      char: 'u',
      description: 'User id, username, or email',
      required: true,
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Assembly name or id',
      multiple: true,
      required: true,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Revoke)
    const access = await this.getAccess()

    const userId = await resolveUserId(
      access.address,
      access.accessToken,
      flags.user,
    )
    const assemblyIds = await resolveAssemblyIds(
      access.address,
      access.accessToken,
      flags.assembly,
    )

    const updated = []
    for (const assemblyId of assemblyIds) {
      const auth: RequestInit = {
        method: 'PUT',
        body: JSON.stringify({
          canViewAnnotations: false,
          canEditAnnotations: false,
        }),
        headers: {
          Authorization: `Bearer ${access.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
      const url = new URL(
        localhostToAddress(
          `${access.address}/assemblyPermissions/${userId}/${assemblyId}`,
        ),
      )
      const response = await fetch(url, auth)
      if (!response.ok) {
        const errorMessage = await createFetchErrorMessage(
          response,
          `revoke failed for assembly '${assemblyId}'`,
        )
        throw new Error(errorMessage)
      }
      updated.push(await response.json())
    }

    this.log(JSON.stringify(updated, null, 2))
  }
}
