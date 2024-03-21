import { Flags } from '@oclif/core'
import { Response } from 'node-fetch'

import { BaseCommand } from '../../baseCommand.js'
import {
  getAssemblyFromRefseq,
  getFeatureById,
  idReader,
  localhostToAddress,
} from '../../utils.js'

export default class EditAttibute extends BaseCommand<typeof EditAttibute> {
  static description = 'Add or edit a feature attribute'

  static flags = {
    'feature-id': Flags.string({
      char: 'i',
      default: '-',
      description: 'Feature ID to edit or "-" to read it from stdin',
    }),
    attribute: Flags.string({
      char: 'a',
      required: true,
      description: 'Attribute key to add or edit',
    }),
    value: Flags.string({
      char: 'v',
      multiple: true,
      description: 'New attribute value or return current value if unset',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(EditAttibute)

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

    if (flags.value === undefined) {
      this.log(JSON.stringify(featureJson.attributes[flags.attribute]))
      this.exit(0)
    }

    featureJson.attributes[flags.attribute] = flags.value

    const assembly = await getAssemblyFromRefseq(
      access.address,
      access.accessToken,
      featureJson['refSeq' as keyof typeof featureJson],
    )

    const changeJson = {
      typeName: 'FeatureAttributeChange',
      changedIds: [featureId],
      assembly,
      featureId,
      attributes: featureJson.attributes,
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
