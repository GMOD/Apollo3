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
  static description = 'Edit type of feature'

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description: 'Feature ID to edit or "-" to read it from stdin',
    }),
    type: Flags.string({
      char: 't',
      required: true,
      description: 'Assign this type',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Get)

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

    const currentType = featureJson['type' as keyof typeof featureJson]
    if (flags.type === currentType) {
      this.logToStderr(
        `NOTE: Feature ${featureId} is already of type "${flags.type}"`,
      )
      this.exit(0)
    }

    const assembly = await getAssemblyFromRefseq(
      access.address,
      access.accessToken,
      featureJson['refSeq' as keyof typeof featureJson],
    )

    const changeJson = {
      typeName: 'TypeChange',
      changedIds: [featureId],
      assembly,
      featureId,
      oldType: currentType,
      newType: flags.type,
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
      await fetch(url, auth)
    } catch (error) {
      if (error instanceof Error) {
        this.logToStderr(error.message)
      }
      throw error
    }
  }
}
