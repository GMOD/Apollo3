import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { localhostToAddress, subAssemblyNameToId } from '../../utils.js'

export default class Delete extends BaseCommand<typeof Delete> {
  static description = 'Delete assemblies'

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Assembly names or IDs to delete',
      multiple: true,
      required: true,
    }),
  }

  private async deleteAssembly(
    address: string,
    accessToken: string,
    assemblyId: string,
  ): Promise<void> {
    const body = {
      typeName: 'DeleteAssemblyChange',
      assembly: assemblyId,
    }

    const auth = {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }

    const url = new URL(localhostToAddress(`${address}/changes`))
    const response = await fetch(url, auth)
    if (!response.ok) {
      const json = JSON.parse(await response.text())
      const message: string = json['message' as keyof typeof json]
      throw new Error(message)
    }
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Delete)

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const deleteIds = await subAssemblyNameToId(
      access.address,
      access.accessToken,
      flags.assembly,
    )
    for (const x of deleteIds) {
      await this.deleteAssembly(access.address, access.accessToken, x)
    }
  }
}
