import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'

export default class Get extends BaseCommand<typeof Get> {
  static description =
    'Get features in assembly, reference sequence or genomic window'

  static examples = [
    {
      description: 'Get features and validation checks as [features, checks]:',
      command:
        '<%= config.bin %> <%= command.id %> -a myAssembly --include-checks',
    },
    {
      description: 'Get all features in myAssembly:',
      command: '<%= config.bin %> <%= command.id %> -a myAssembly',
    },
    {
      description:
        'Get features intersecting chr1:1..1000. You can omit the assembly name if there are no other reference sequences named chr1:',
      command:
        '<%= config.bin %> <%= command.id %> -a myAssembly -r chr1 -s 1 -e 1000',
    },
  ]

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description: 'Find input reference sequence in this assembly',
    }),
    refseq: Flags.string({
      char: 'r',
      description: 'Reference sequence. If unset, query all sequences',
    }),
    start: Flags.integer({
      char: 's',
      description: 'Start coordinate (1-based)',
      default: 1,
    }),
    'include-checks': Flags.boolean({
      description: 'Output [features, checks] instead of only features',
    }),
    end: Flags.integer({
      char: 'e',
      description: 'End coordinate',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    const endCoord: number = flags.end ?? Number.MAX_SAFE_INTEGER
    if (flags.start <= 0 || endCoord <= 0) {
      this.error('Start and end coordinates must be greater than 0.')
    }

    const refseqIds: string[] = await this.getRefseqId(
      flags.refseq,
      flags.assembly,
    )

    const results: object[] = []
    const checks: object[] = []
    for (const refseq of refseqIds) {
      const [refseqFeatures, refseqChecks] = await this.getFeatures(
        refseq,
        flags.start,
        endCoord,
      )
      for (const feature of refseqFeatures) {
        results.push(feature)
      }
      if (flags['include-checks']) {
        for (const check of refseqChecks) {
          checks.push(check)
        }
      }
    }
    this.log(
      JSON.stringify(
        flags['include-checks'] ? [results, checks] : results,
        null,
        2,
      ),
    )
  }

  private async getFeatures(
    refSeq: string,
    start: number,
    end: number,
  ): Promise<[object[], object[]]> {
    const searchParams = new URLSearchParams({
      refSeq,
      start: start.toString(),
      end: end.toString(),
    })
    return (await this.get(
      `features/getFeatures?${searchParams.toString()}`,
    )) as [object[], object[]]
  }
}
