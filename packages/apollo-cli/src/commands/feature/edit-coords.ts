import { Flags } from '@oclif/core'
import { Response, fetch } from 'undici'

import {
  SerializedLocationStartChange,
  type SerializedLocationEndChange,
} from '@apollo-annotation/shared'
import { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'

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
      this.error('Please provide new start and/or end coordinates to edit')
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

    const ff = await idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.error(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const access = await this.getAccess()

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
    const featureJson = JSON.parse(
      await res.text(),
    ) as AnnotationFeatureSnapshot

    const assembly = await getAssemblyFromRefseq(
      access.address,
      access.accessToken,
      featureJson.refSeq,
    )

    const currentEnd = featureJson.max
    let edit = ['Start', 'End']
    if (flags.start !== undefined && flags.start > currentEnd) {
      // Edit End (Max) first so you avoid an intermediate start > end
      edit = ['End', 'Start']
    }

    for (const coord of edit) {
      const currentStart = featureJson.min
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

      let body: SerializedLocationStartChange | SerializedLocationEndChange
      if (coord === 'Start' && flags.start !== undefined) {
        const oldCoord = featureJson.min
        body = {
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          assembly,
          featureId,
          ['oldStart']: oldCoord,
          ['newStart']: flags.start,
        }
      } else if (coord === 'End' && flags.end !== undefined) {
        const oldCoord = featureJson.max
        body = {
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          assembly,
          featureId,
          ['oldEnd']: oldCoord,
          ['newEnd']: flags.end,
        }
      } else {
        throw new Error(`Unexpected coordinate name: "${coord}"`)
      }

      const url = new URL(localhostToAddress(`${access.address}/changes`))
      const auth = {
        method: 'POST',
        body: JSON.stringify(body),
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
