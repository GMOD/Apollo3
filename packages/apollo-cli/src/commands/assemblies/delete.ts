import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { filterJsonList, localhostToAddress, queryApollo } from '../../utils.js'

export default class Delete extends BaseCommand<typeof Delete> {
  static description = 'Delete assemblies'

  static flags = {
    names: Flags.string({
      char: 'n',
      description: 'Assembly names to delete',
      multiple: true,
      required: true,
    }),
  }

  private async getAssemblyIdFromName(
    address: string,
    accessToken: string,
    names: string[],
  ): Promise<string[]> {
    const assemblies: Response = await queryApollo(
      address,
      accessToken,
      'assemblies',
    )
    const json = await assemblies.json()
    const ids: string[] = []

    for (const x of new Set(names)) {
      const toDelete = filterJsonList(json, [x], 'name')
      if (toDelete.length === 0) {
        this.logToStderr(`Note: No assembly found with name "${x}"`)
      } else if (toDelete.length > 1) {
        throw new Error(`Error: More than one assembly have name "${x}"`)
      } else {
        ids.push(toDelete[0]['_id' as keyof (typeof toDelete)[0]])
      }
    }
    return ids
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

    const deleteIds = await this.getAssemblyIdFromName(
      access.address,
      access.accessToken,
      flags.names,
    )
    for (const x of deleteIds) {
      await this.deleteAssembly(access.address, access.accessToken, x)
    }
  }
}
