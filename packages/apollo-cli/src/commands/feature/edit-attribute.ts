import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type { SerializedFeatureAttributeChange } from '@apollo-annotation/shared'
import { Flags } from '@oclif/core'
import { type Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import {
  createFetchErrorMessage,
  getAssemblyFromRefseq,
  getFeatureById,
  idReader,
  localhostToAddress,
} from '../../utils.js'

export default class EditAttibute extends BaseCommand<typeof EditAttibute> {
  static summary = 'Add, edit, or view a feature attribute'
  static description =
    'Be aware that there is no checking whether attributes names and values are valid. \
For example, you can create non-unique ID attributes or you can set gene ontology \
terms to non-existing terms'

  static examples = [
    {
      description: 'Add attribute "domains" with a list of values:',
      command:
        '<%= config.bin %> <%= command.id %> -i 66...3f -a domains -v ABC PLD',
    },
    {
      description: 'Print values in "domains" as json array:',
      command: '<%= config.bin %> <%= command.id %> -i 66...3f -a domains',
    },
    {
      description: 'Delete attribute "domains"',
      command: '<%= config.bin %> <%= command.id %> -i 66...3f -a domains -d',
    },
  ]

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
      description:
        'New attribute value. Separated mutliple values by space to them as a list. If unset return current value',
    }),
    delete: Flags.boolean({
      char: 'd',
      description: 'Delete this attribute',
    }),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(EditAttibute)

    if (flags.delete && flags.value) {
      this.error('Error: Options --delete and --value are mutually exclusive')
    }

    const ff = await idReader([flags['feature-id']])
    if (ff.length !== 1) {
      this.error(`Expected only one feature identifier. Got ${ff.length}`)
    }
    const [featureId] = ff

    const access = await this.getAccess()

    const response: Response = await getFeatureById(
      access.address,
      access.accessToken,
      featureId,
    )
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'getFeatureById failed',
      )
      throw new Error(errorMessage)
    }
    const featureJson = JSON.parse(
      await response.text(),
    ) as AnnotationFeatureSnapshot
    if (featureJson.attributes === undefined) {
      featureJson.attributes = {}
    }

    const oldAttributes: Record<string, string[]> = {}
    for (const [key, val] of Object.entries(featureJson.attributes)) {
      if (!val) {
        continue
      }
      oldAttributes[key] = [...val]
    }

    if (flags.value === undefined && !flags.delete) {
      this.log(JSON.stringify(oldAttributes[flags.attribute]))
      return
    }

    const newAttributes: Record<string, string[]> = {}
    for (const [key, val] of Object.entries(oldAttributes)) {
      newAttributes[key] = [...val]
    }

    if (flags.delete) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete newAttributes[flags.attribute]
    } else if (flags.value) {
      newAttributes[flags.attribute] = flags.value
    } else {
      throw new Error(`Unexpected condition: value is "${flags.value}"`)
    }

    const assembly = await getAssemblyFromRefseq(
      access.address,
      access.accessToken,
      featureJson.refSeq,
    )

    const changeJson: SerializedFeatureAttributeChange = {
      typeName: 'FeatureAttributeChange',
      changedIds: [featureId],
      assembly,
      featureId,
      oldAttributes,
      newAttributes,
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
    const res = await fetch(url, auth)
    if (!res.ok) {
      const errorMessage = await createFetchErrorMessage(
        res,
        'edit-attribute failed',
      )
      throw new Error(errorMessage)
    }
  }
}
