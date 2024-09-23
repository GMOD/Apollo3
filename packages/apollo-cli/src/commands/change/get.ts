import { Flags } from '@oclif/core'
import { Response } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { convertAssemblyNameToId, idReader, queryApollo } from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Get list of changes'
  static description =
    'Return the change log in json format. Note \
that when an assembly is deleted the link between common name and ID is lost \
(it can still be recovered by inspecting the change log but at present this task is left to the user). \
In such cases you need to use the assembly ID.'

  static flags = {
    assembly: Flags.string({
      char: 'a',
      multiple: true,
      description:
        'Get changes only for these assembly names or IDs (but see description)',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const access = await this.getAccess()

    const changes: Response = await queryApollo(
      access.address,
      access.accessToken,
      'changes',
    )
    const json = (await changes.json()) as object[]

    let keep = json
    if (flags.assembly !== undefined) {
      keep = []
      const assembly = await idReader(flags.assembly)
      const assemblyIds = await convertAssemblyNameToId(
        access.address,
        access.accessToken,
        assembly,
      )
      for (const x of json) {
        if (assemblyIds.includes(x['assembly' as keyof typeof x])) {
          keep.push(x)
        }
      }
    }
    this.log(JSON.stringify(keep, null, 2))
  }
}
