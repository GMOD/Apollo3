/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { ApolloRefSeqSnapshot } from '@apollo-annotation/mst'
import { Flags } from '@oclif/core'

import { BaseCommand } from '../../baseCommand.js'
import { idReader } from '../../utils.js'

export default class ApolloCmd extends BaseCommand<typeof ApolloCmd> {
  static summary = 'Get reference sequence in fasta format'
  static description =
    'Return the reference sequence for a given assembly and coordinates'

  static examples = [
    {
      description: 'Get all sequences in myAssembly:',
      command: '<%= config.bin %> <%= command.id %> -a myAssembly',
    },
    {
      description: 'Get sequence in coordinates chr1:1..1000:',
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
      description: 'Reference sequence. If unset, get all sequences',
    }),
    start: Flags.integer({
      char: 's',
      description: 'Start coordinate (1-based)',
      default: 1,
    }),
    end: Flags.integer({
      char: 'e',
      description: 'End coordinate',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(ApolloCmd)

    const endCoord: number = flags.end ?? Number.MAX_SAFE_INTEGER
    if (flags.start <= 0 || endCoord <= 0) {
      this.error('Start and end coordinates must be greater than 0.')
    }

    let assembly = undefined
    if (flags.assembly !== undefined) {
      ;[assembly] = await idReader([flags.assembly])
    }

    const refseqIds = await this.getRefseqId(flags.refseq, assembly)
    if (refseqIds.length === 0) {
      this.error('No reference sequence found')
    }

    const refSeqs = (await this.get('refSeqs')) as ApolloRefSeqSnapshot[]
    for (const rid of refseqIds) {
      const searchParams = new URLSearchParams({
        refSeq: rid,
        start: (flags.start - 1).toString(),
        end: endCoord.toString(),
      })
      const res = await this.fetch(`sequence?${searchParams.toString()}`)

      const seqObj = await res.body?.getReader().read()
      const seq: string = new TextDecoder().decode(seqObj?.value)
      let header = ''
      for (const x of refSeqs) {
        if (x._id === rid) {
          const rname = x.name
          header = `>${rname}:${flags.start}..${flags.start + seq.length - 1}`
          break
        }
      }
      this.log(header)
      this.log(splitStringIntoChunks(seq, 80).join('\n'))
    }
  }
}

function splitStringIntoChunks(input: string, chunkSize: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < input.length; i += chunkSize) {
    const chunk = input.slice(i, i + chunkSize)
    chunks.push(chunk)
  }
  return chunks
}
