/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  getAssemblyFromRefseq,
  getFeatureById,
  idReader,
  localhostToAddress,
  wrapLines,
} from '../../utils.js'

export default class Get extends BaseCommand<typeof Get> {
  static summary = 'Edit feature start and/or end coordinates'
  static description = wrapLines(
    "If editing a child feature that new coordinates must be within the parent's coordinates.\
    To get the identifier of the feature to edit consider using `apollo feature get` or `apollo feature search`",
  )

  static examples = [
    {
      description: 'Edit start and end:',
      command: '<%= config.bin %> <%= command.id %> -i abc...xyz -s 10 -e 1000',
    },
    {
      description: 'Edit end and leave start as it is:',
      command: '<%= config.bin %> <%= command.id %> -i abc...xyz -e 2000',
    },
  ]

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
      this.error(
        'Please provide new start and/or end coordinates to edit',
      )
    }

    if (flags.start !== undefined && flags.start <= 0) {
      this.error('Coordinates must be greater than 0')
    }

    if (
      flags.start !== undefined &&
      flags.end !== undefined &&
      flags.end < flags.start
    ) {
      this.error(
        'Error: The new end coordinate is lower than the new start coordinate',
      )
    }

    if (flags.start !== undefined) {
      flags.start -= 1
    }

    const ff = idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.error(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const access: { address: string; accessToken: string } =
      await this.getAccess(flags['config-file'], flags.profile)

    const res: Response = await getFeatureById(
      access.address,
      access.accessToken,
      featureId,
    )
    if (!res.ok) {
      const errorMessage = await createFetchErrorMessage(
        res,
        'getFeatureById failed',
      )
      throw new Error(errorMessage)
    }
    const featureJson = JSON.parse(await res.text())

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
      const response = await fetch(url, auth)
      if (!response.ok) {
        const errorMessage = await createFetchErrorMessage(
          response,
          'edit-coords failed',
        )
        throw new Error(errorMessage)
      }
    }
  }
}
