import { readConfObject } from '@jbrowse/core/configuration'
import {
  Alias,
  BaseAdapter,
  BaseRefNameAliasAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'

export class ApolloRefNameAliasAdapter
  extends BaseAdapter
  implements BaseRefNameAliasAdapter
{
  async getRefNameAliases(): Promise<Alias[]> {
    const aliasesConfig: Record<string, string[]> = readConfObject(
      this.config,
      'aliases',
    )
    return Object.entries(aliasesConfig).map(([refName, aliasList]) => ({
      refName,
      aliases: aliasList,
    }))
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async freeResources() {}
}
