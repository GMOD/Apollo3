import type {
  ApolloAssemblySnapshot,
  CheckResultSnapshot,
} from '@apollo-annotation/mst'
import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { idReader } from '../../utils.js'

export default class Check extends BaseCommand<typeof Check> {
  static summary = 'Get check results'
  static description =
    'Use this command to view which features fail checks along with the reason for failing.\
Use `apollo assembly check` for managing which checks should be applied to an assembly'

  static examples = [
    {
      description: 'Get all check results in the database:',
      command: '<%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Get check results for assembly hg19:',
      command: '<%= config.bin %> <%= command.id %> -a hg19',
    },
  ]

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      description: 'Get checks for these feature identifiers',
      multiple: true,
    }),
    assembly: Flags.string({
      char: 'a',
      description: 'Get checks for this assembly',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Check)

    let keepFeatures = new Set<string>()
    if (flags['feature-id'] !== undefined) {
      keepFeatures = new Set(await idReader(flags['feature-id']))
    }

    const keepAsmId: string[] = await this.keepAssemblies(flags.assembly)

    const refseq = (await this.get('refseqs')) as object[]
    const refseqId = new Set<string>()
    for (const x of refseq) {
      if (keepAsmId.includes(x['assembly' as keyof typeof x])) {
        refseqId.add(x['_id' as keyof typeof x])
      }
    }

    const checks = (await this.get('checks')) as CheckResultSnapshot[]
    const results: CheckResultSnapshot[] = []
    for (const chk of checks) {
      let keep = false
      if (flags['feature-id'] === undefined) {
        keep = true
      } else if (chk.ids !== undefined) {
        for (const x of chk.ids) {
          if (x !== undefined && keepFeatures.has(x.toString())) {
            keep = true
            break
          }
        }
      }
      if (keep && refseqId.has(chk.refSeq)) {
        results.push(chk)
      }
    }
    results.sort((a, b) => (a.start < b.start ? -1 : 1))
    this.log(JSON.stringify(results, null, 2))
  }

  async keepAssemblies(assembly: string | undefined): Promise<string[]> {
    let keepAssembly: string[] = []
    if (assembly === undefined) {
      const asm = (await this.get('assemblies')) as ApolloAssemblySnapshot[]
      for (const x of asm) {
        keepAssembly.push(x._id)
      }
    } else {
      const ids = await idReader([assembly])
      keepAssembly = await this.convertAssemblyNameToId(ids)
    }
    return keepAssembly
  }
}
