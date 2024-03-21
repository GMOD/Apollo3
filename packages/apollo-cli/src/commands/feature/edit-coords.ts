import { Flags } from '@oclif/core'
import { Response } from 'node-fetch'

import { BaseCommand } from '../../baseCommand.js'
import {
  getAssemblyFromRefseq,
  getFeatureById,
  idReader,
  localhostToAddress,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static description = 'Edit feature coordinates (start and/or end)'

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description: 'Feature ID to edit or "-" to read it from stdin',
    }),
    start: Flags.integer({
      char: 's',
      description: 'New start coordinate (1-based)',
    }),
    end: Flags.integer({
      char: 'e',
      description: 'New end coordinate (1-based)',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

    if (flags.start === undefined && flags.end === undefined) {
      this.logToStderr(
        'Please provide new start and/or end coordinates to edit',
      )
      this.exit(1)
    }

    if (flags.start !== undefined && flags.start <= 0) {
      this.logToStderr('Coordinates must be greater than 0')
      this.exit(1)
    }

    if (
      flags.start !== undefined &&
      flags.end !== undefined &&
      flags.end < flags.start
    ) {
      this.logToStderr(
        'Error: The new end coordinate is lower than the new start coordinate',
      )
      this.exit(1)
    }

    if (flags.start !== undefined) {
      flags.start -= 1
    }

    const ff = idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.logToStderr(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const response: Response = await getFeatureById(
      access.address,
      access.accessToken,
      featureId,
    )
    const featureJson = JSON.parse(await response.text())
    if (!response.ok) {
      const message: string = featureJson['message' as keyof typeof featureJson]
      this.logToStderr(message)
      this.exit(1)
    }

    const assembly = await getAssemblyFromRefseq(
      access.address,
      access.accessToken,
      featureJson['refSeq' as keyof typeof featureJson],
    )

    const currentEnd = featureJson['end' as keyof typeof featureJson]
    let edit = ['Start', 'End']
    if (flags.start !== undefined && flags.start > currentEnd) {
      // Edit End first so you avoid an intermediate start > end
      edit = ['End', 'Start']
    }

    for (const coord of edit) {
      const currentStart = featureJson['start' as keyof typeof featureJson]
      if (
        coord === 'Start' &&
        (flags.start === undefined || flags.start === currentStart)
      ) {
        continue
      } else if (
        coord === 'End' &&
        (flags.end === undefined || flags.end === currentEnd)
      ) {
        continue
      }

      const changeJson = {
        typeName: `Location${coord}Change`,
        changedIds: [featureId],
        assembly,
        featureId,
        [`old${coord}`]:
          featureJson[coord.toLowerCase() as keyof typeof featureJson],
        [`new${coord}`]: flags[coord.toLowerCase() as keyof typeof flags],
      }

      const url = new URL(localhostToAddress(`${access.address}/changes`))
      const auth = {
        method: 'POST',
        body: JSON.stringify(changeJson),
        headers: {
          authorization: `Bearer ${access.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
      try {
        const response = await fetch(url, auth)
        if (!response.ok) {
          const j = await response.json()
          const message: string = j['message' as keyof typeof j]
          this.logToStderr(message)
          this.exit(1)
        }
      } catch (error) {
        if (error instanceof Error) {
          this.logToStderr(error.message)
        }
        throw error
      }
    }
  }
}
