import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  getRefseqId,
  idReader,
  localhostToAddress,
  queryApollo,
} from '../../utils.js'

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

  const controller = new AbortController()
  setTimeout(
    () => {
      controller.abort()
    },
    24 * 60 * 60 * 1000,
  )

  const auth = {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    signal: controller.signal,
  }
  return fetch(uri, auth)
}

export default class ApolloCmd extends BaseCommand<typeof ApolloCmd> {
  static description = 'Get reference sequence'

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
      this.logToStderr('Start and end coordinates must be greater than 0.')
      this.exit(1)
    }

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    let assembly = undefined
    if (flags.assembly !== undefined) {
      ;[assembly] = idReader([flags.assembly])
    }

    let refseqIds: string[] = []
    try {
      refseqIds = await getRefseqId(
        access.address,
        access.accessToken,
        flags.refseq,
        assembly,
      )
    } catch (error) {
      this.logToStderr((error as Error).message)
      this.exit(1)
    }
    if (refseqIds.length === 0) {
      this.logToStderr('No reference sequence found')
      this.exit(1)
    }

    const refs: Response = await queryApollo(
      access.address,
      access.accessToken,
      'refSeqs',
    )
    const refSeqs = (await refs.json()) as object[]
    for (const rid of refseqIds) {
      const res = await getSequence(
        access.address,
        access.accessToken,
        rid,
        flags.start - 1,
        endCoord,
      )
      if (!res.ok) {
        const json = JSON.parse(await res.text())
        const message: string = json['message' as keyof typeof json]
        this.logToStderr(message)
        this.exit(1)
      }

      const seq = res.body?.toString() ?? ''
      let header = ''
      for (const x of refSeqs) {
        if (x['_id' as keyof typeof x] === rid) {
          const rname = x['name' as keyof typeof x]
          header = `>${rname}:${flags.start}..${flags.start + seq.length - 1}`
          break
        }
      }
      this.log(header)
      this.log(wrapString(seq, 80).join('\n'))
    }
    this.exit(0)
  }
}

function wrapString(x: string, lineLen: number): string[] {
  let start = 0
  const wrapped = []
  while (start < x.length) {
    const end = start + lineLen < x.length ? start + lineLen : x.length
    wrapped.push(x.slice(start, end))
    start += lineLen
  }
  return wrapped
}