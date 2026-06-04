import { Flags } from '@oclif/core'
import { type RequestInit, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { createFetchErrorMessage, localhostToAddress } from '../../utils.js'
import { resolveAssemblyIds, resolveUserId } from '../../permissionsUtils.js'

export default class Grant extends BaseCommand<typeof Grant> {
  static summary = 'Grant assembly permissions to a user'
  static description =
    'Grants annotation permissions for one user across one or more assemblies.'

  static examples = [
    {
      description: 'Grant view access to one assembly:',
      command:
        '<%= config.bin %> <%= command.id %> -u user@example.org -a myAssembly --view',
    },
    {
      description: 'Grant edit access to multiple assemblies (implies view):',
      command:
        '<%= config.bin %> <%= command.id %> -u user@example.org -a asm1 asm2 --edit',
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
    view: Flags.boolean({
      description: 'Grant view permission',
      default: false,
    }),
    edit: Flags.boolean({
      description: 'Grant edit permission (implies view)',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Grant)
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

    const canEditAnnotations = flags.edit
    const canViewAnnotations = flags.view || canEditAnnotations || !flags.edit

    const updated = []
    for (const assemblyId of assemblyIds) {
      const auth: RequestInit = {
        method: 'PUT',
        body: JSON.stringify({
          canViewAnnotations,
          canEditAnnotations,
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
          `grant failed for assembly '${assemblyId}'`,
        )
        throw new Error(errorMessage)
      }
      updated.push(await response.json())
    }

    this.log(JSON.stringify(updated, null, 2))
  }
}
