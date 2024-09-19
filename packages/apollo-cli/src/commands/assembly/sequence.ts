/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Flags } from '@oclif/core'
import { Agent, RequestInit, Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  getRefseqId,
  idReader,
  localhostToAddress,
  queryApollo,
  wrapLines,
} from '../../utils.js'
import { ApolloRefSeqSnapshot } from '@apollo-annotation/mst'

async function getSequence(
  address: string,
  accessToken: string,
  refSeq: string,
  start: number,
  end: number,
): Promise<Response> {
  const url = new URL(localhostToAddress(`${address}/sequence`))
  const searchParams = new URLSearchParams({
    refSeq,
    start: start.toString(),
    end: end.toString(),
  })
  url.search = searchParams.toString()
  const uri = url.toString()

  const auth: RequestInit = {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    dispatcher: new Agent({ headersTimeout: 60 * 60 * 1000 }),
  }
  const response = await fetch(uri, auth)
  if (!response.ok) {
    const errorMessage = await createFetchErrorMessage(
      response,
      'getSequence failed',
    )
    throw new Error(errorMessage)
  }
  return response
}

export default class ApolloCmd extends BaseCommand<typeof ApolloCmd> {
  static summary = 'Get reference sequence in fasta format'
  static description = wrapLines(
    'Return the reference sequence for a given assembly and coordinates',
  )

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

    const access = await this.getAccess()

    let assembly = undefined
    if (flags.assembly !== undefined) {
      ;[assembly] = idReader([flags.assembly])
    }

    let refseqIds: string[] = []
    refseqIds = await getRefseqId(
      access.address,
      access.accessToken,
      flags.refseq,
      assembly,
    )
    if (refseqIds.length === 0) {
      this.error('No reference sequence found')
    }

    const refs: Response = await queryApollo(
      access.address,
      access.accessToken,
      'refSeqs',
    )
    const refSeqs = (await refs.json()) as ApolloRefSeqSnapshot[]
    for (const rid of refseqIds) {
      const res = await getSequence(
        access.address,
        access.accessToken,
        rid,
        flags.start - 1,
        endCoord,
      )

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
