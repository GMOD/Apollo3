import { readFile } from 'node:fs/promises'

import type { AnnotationFeatureSnapshot } from '@apollo-annotation/mst'
import type {
  AddFeatureChangeDetails,
  SerializedAddFeatureChange,
} from '@apollo-annotation/shared'
import { Args, Flags } from '@oclif/core'
import { ObjectId } from 'bson'
import { type Response, fetch } from 'undici'

import { BaseCommand } from '../../baseCommand.js'
import { createFetchErrorMessage, localhostToAddress } from '../../utils.js'

interface BaseFeatureJSON {
  min: number
  max: number
  type: string
  children?: BaseFeatureJSON[]
  [key: string]: unknown
}

interface FeatureJSON extends BaseFeatureJSON {
  assembly?: string
  refSeq: string
}

export default class Add extends BaseCommand<typeof Add> {
  static summary = 'Add one or more features to Apollo'
  static description = `A single simple feature can be added using the --min, --max, etc. flags.

To add multiple features, features with more details, or features with children, you can pass in JSON via argument or stdin or use the --feature-json-file options.
`

  static examples = [
    {
      description: 'Add a single feature by specifying its location and type',
      command:
        '<%= config.bin %> <%= command.id %> --assembly hg19 --refSeq chr3 --min 1000 --max 5000 --type remark',
    },
    {
      description: 'Add a single feature from inline JSON',
      command:
        '<%= config.bin %> <%= command.id %> \'{"assembly":"<assemblyNameOrId>","refseq":"<refSeqNameOrId>","min":1,"max":100,"type":"<featureType>"}\'',
    },
    {
      description: 'Add mutilple features from stdin JSON',
      command:
        'echo \'[{"assembly":"<assemblyNameOrId>","refseq":"<refSeqNameOrId>","min":1,"max":100,"type":"<featureType>"},{"assembly":"<assemblyNameOrId>","refseq":"<refSeqNameOrId>","min":101,"max":200,"type":"<featureType>"}]\' | <%= config.bin %> <%= command.id %>',
    },
    {
      description: 'Add a feature with children from inline JSON',
      command:
        '<%= config.bin %> <%= command.id %> \'{"assembly":"<assemblyNameOrId>","refseq":"<refSeqNameOrId>","min":1,"max":100,"type":"<featureType>","children":[{"min":1,"max":50,"type":"<featureType>"}]}\'',
    },
  ]

  static flags = {
    assembly: Flags.string({
      char: 'a',
      description:
        'Name or ID of target assembly. Not required if refseq is unique in the database',
    }),
    refSeq: Flags.string({
      char: 'r',
      description: 'Name or ID of target reference sequence',
      dependsOn: ['min', 'max', 'type'],
      exclusive: ['feature-json-file'],
    }),
    min: Flags.integer({
      char: 's',
      description: 'Start position in target reference sequence',
      dependsOn: ['refSeq', 'max', 'type'],
      exclusive: ['feature-json-file'],
    }),
    max: Flags.integer({
      char: 'e',
      description: 'End position in target reference sequence',
      dependsOn: ['refSeq', 'min', 'type'],
      exclusive: ['feature-json-file'],
    }),
    type: Flags.string({
      char: 't',
      description: 'Type of child feature',
      dependsOn: ['refSeq', 'min', 'max'],
      exclusive: ['feature-json-file'],
    }),
    'feature-json-file': Flags.file({
      char: 'F',
      description: 'File with JSON describing the feature(s) to add',
      exists: true,
    }),
  }

  static args = {
    'feature-json': Args.string({
      description:
        'Inline JSON describing the feature(s) to add. Can also be provided via stdin.',
    }),
  }

  public async run(): Promise<void> {
    const { args, flags } = this
    const { 'feature-json': featureJSONString } = args
    const {
      assembly,
      refSeq,
      min,
      max,
      type,
      'feature-json-file': featureJSONFile,
    } = flags
    if (featureJSONString) {
      if (
        assembly !== undefined ||
        refSeq !== undefined ||
        min !== undefined ||
        max !== undefined ||
        type !== undefined ||
        featureJSONFile !== undefined
      ) {
        this.error(
          'Cannot use the following flags when providing a feature JSON: --assembly, --refSeq, --min, --max, --type, --feature-json-file',
        )
      }
      await this.addFeatureFromJSON(featureJSONString)
      return
    }
    if (featureJSONFile) {
      const fileText = await readFile(featureJSONFile, 'utf8')
      await this.addFeatureFromJSON(fileText)
      return
    }
    if (
      refSeq === undefined ||
      min === undefined ||
      max === undefined ||
      type === undefined
    ) {
      this.error('Must provide all of: --refSeq, --min, --max, and --type')
    }
    await this.addFeatureFromFlags(refSeq, min, max, type, assembly)
  }

  async addFeatureFromJSON(featureJSONString: string) {
    let featureJSON: FeatureJSON | FeatureJSON[]
    try {
      featureJSON = parseFeatureJSON(featureJSONString)
    } catch (error) {
      this.logToStderr('Error: feature JSON is not valid')
      if (error instanceof Error || typeof error === 'string') {
        this.error(error)
      }
      throw error
    }
    if (Array.isArray(featureJSON)) {
      const firstFeature = featureJSON.at(0)
      if (!firstFeature) {
        throw new Error('Feature array is empty')
      }
      const { assembly, refSeq } = firstFeature
      if (!featureJSON.every((feature) => feature.assembly === assembly)) {
        throw new Error(
          'Cannot add features to multiple assemblies at the same time',
        )
      }
      const [assemblyId] = await this.getAssemblyAndRefSeqIds(refSeq, assembly)
      const changedIds: string[] = []
      const changes = await Promise.all(
        featureJSON.map(
          async (singleFeatureJSON): Promise<AddFeatureChangeDetails> => {
            const { children, assembly, refSeq, ...rest } = singleFeatureJSON
            const refSeqDocument = await this.getRefSeq(refSeq)
            return {
              addedFeature: this.makeFeatureSnapshot(
                {
                  assembly: assemblyId,
                  refSeq: refSeqDocument._id,
                  ...rest,
                },
                changedIds,
              ),
            }
          },
        ),
      )
      const change: SerializedAddFeatureChange = {
        changedIds,
        typeName: 'AddFeatureChange',
        assembly: assemblyId,
        changes,
      }
      return this.submitChange(change)
    }
    const { assembly, refSeq, ...rest } = featureJSON
    const [assemblyId, refSeqId] = await this.getAssemblyAndRefSeqIds(
      refSeq,
      assembly,
    )
    const changedIds: string[] = []
    const details = {
      addedFeature: this.makeFeatureSnapshot(
        {
          assembly: assemblyId,
          refSeq: refSeqId,
          ...rest,
        },
        changedIds,
      ),
    }
    const change: SerializedAddFeatureChange = {
      changedIds,
      typeName: 'AddFeatureChange',
      assembly: assemblyId,
      ...details,
    }
    return this.submitChange(change)
  }

  makeFeatureSnapshot(
    details: FeatureJSON,
    ids: string[],
  ): AnnotationFeatureSnapshot {
    const { children, ...rest } = details
    let childrenDetails: undefined | Record<string, AnnotationFeatureSnapshot> =
      undefined
    if (children) {
      childrenDetails = {}
      const { refSeq } = rest
      for (const child of children) {
        const childDetails = this.makeFeatureSnapshot({ refSeq, ...child }, ids)
        childrenDetails[childDetails._id] = childDetails
      }
    }
    const _id = new ObjectId().toHexString()
    ids.push(_id)
    return {
      _id,
      ...rest,
      ...(childrenDetails ? { children: childrenDetails } : {}),
    }
  }

  async addFeatureFromFlags(
    refSeqNameOrId: string,
    min: number,
    max: number,
    type: string,
    assemblyNameOrId?: string,
  ) {
    const [assemblyId, refSeqId] = await this.getAssemblyAndRefSeqIds(
      refSeqNameOrId,
      assemblyNameOrId,
    )
    const changedIds: string[] = []
    const details = {
      addedFeature: this.makeFeatureSnapshot(
        { refSeq: refSeqId, min: min - 1, max, type },
        changedIds,
      ),
    }
    const change: SerializedAddFeatureChange = {
      changedIds,
      typeName: 'AddFeatureChange',
      assembly: assemblyId,
      ...details,
    }
    return this.submitChange(change)
  }

  async getAssemblyAndRefSeqIds(
    refSeqNameOrId: string,
    assemblyNameOrId?: string,
  ): Promise<[string, string]> {
    const refSeqIsObjectId = ObjectId.isValid(refSeqNameOrId)
    const assemblyIsObjectId = assemblyNameOrId
      ? ObjectId.isValid(assemblyNameOrId)
      : false
    if (assemblyNameOrId && assemblyIsObjectId && refSeqIsObjectId) {
      return [assemblyNameOrId, refSeqNameOrId]
    }
    if (refSeqIsObjectId) {
      if (assemblyNameOrId) {
        this.warn('Ignoring provided --assembly because it is not an ID')
      }
      const refSeqDocument = await this.getRefSeq(refSeqNameOrId)
      return [refSeqDocument.assembly, refSeqNameOrId]
    }
    if (!assemblyNameOrId) {
      this.error(
        `If provided refSeq (${refSeqNameOrId}) is not an ID, assembly must also be provided`,
      )
    }
    const assemblyDocument = await this.getAssembly(assemblyNameOrId)
    const refSeqDocument = await this.getRefSeq(
      refSeqNameOrId,
      assemblyDocument._id,
    )
    return [assemblyDocument._id, refSeqDocument._id]
  }

  async getAssembly(
    assemblyNameOrId: string,
  ): Promise<{ _id: string; name: string; aliases?: string[] }> {
    if (ObjectId.isValid(assemblyNameOrId)) {
      const response = await this.fetch(`assemblies/${assemblyNameOrId}`)
      if (!response.ok) {
        const errorMessage = await createFetchErrorMessage(
          response,
          `Could not find assembly: "${assemblyNameOrId}"`,
        )
        this.error(errorMessage)
      }
      return response.json() as Promise<{
        _id: string
        name: string
        aliases?: string[]
      }>
    }
    const response = await this.fetch('assemblies')
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        `Could not find assembly: "${assemblyNameOrId}"`,
      )
      this.error(errorMessage)
    }
    const assemblies = (await response.json()) as {
      _id: string
      name: string
      aliases?: string[]
    }[]
    for (const assembly of assemblies) {
      if (
        assembly.name === assemblyNameOrId ||
        assembly.aliases?.includes(assemblyNameOrId)
      ) {
        return assembly
      }
    }
    throw new Error(`Could not find assembly: "${assemblyNameOrId}"`)
  }

  async getRefSeq(
    refSeqNameOrId: string,
    assemblyId?: string,
  ): Promise<{
    _id: string
    name: string
    assembly: string
    aliases?: string[]
  }> {
    if (ObjectId.isValid(refSeqNameOrId)) {
      const response = await this.fetch(`refSeqs/${refSeqNameOrId}`)
      if (!response.ok) {
        const errorMessage = await createFetchErrorMessage(
          response,
          `Could not find refSeq: "${refSeqNameOrId}"`,
        )
        this.error(errorMessage)
      }
      return response.json() as Promise<{
        _id: string
        name: string
        assembly: string
        aliases?: string[]
      }>
    }
    let endpoint = 'refSeqs'
    if (assemblyId) {
      const searchParams = new URLSearchParams({ assembly: assemblyId })
      endpoint = `${endpoint}?${searchParams.toString()}`
    }
    const response = await this.fetch(endpoint)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        `Could not find refSeq: "${refSeqNameOrId}"`,
      )
      this.error(errorMessage)
    }
    const refSeqs = (await response.json()) as {
      _id: string
      name: string
      assembly: string
      aliases?: string[]
    }[]
    for (const refSeq of refSeqs) {
      if (
        refSeq.name === refSeqNameOrId ||
        refSeq.aliases?.includes(refSeqNameOrId)
      ) {
        return refSeq
      }
    }
    throw new Error(`Could not find refSeq: "${refSeqNameOrId}"`)
  }

  async submitChange(change: SerializedAddFeatureChange) {
    const options = { method: 'POST', body: JSON.stringify(change) }
    const response = await this.fetch('changes', options)
    if (!response.ok) {
      const errorMessage = await createFetchErrorMessage(
        response,
        'Could not add feature',
      )
      this.error(errorMessage)
    }
    this.log(await response.text())
  }

  async fetch(
    endpoint: string,
    options?: {
      method?: string
      body?: string
      headers?: Record<string, string>
    },
  ): Promise<Response> {
    const { address, accessToken } = await this.getAccess()
    const url = new URL(localhostToAddress(`${address}/${endpoint}`))
    const optionsWithAuth = {
      ...options,
      headers: {
        authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    }
    return fetch(url, optionsWithAuth)
  }
}

function parseFeatureJSON(
  featureJSONString: string,
): FeatureJSON | FeatureJSON[] {
  const featureJSON: unknown = JSON.parse(featureJSONString)
  if (Array.isArray(featureJSON)) {
    return featureJSON.map((feature) => {
      assertFeatureIsValid(feature, true)
      return feature
    })
  }
  assertFeatureIsValid(featureJSON, true)
  return featureJSON
}

function assertFeatureIsValid(
  feature: unknown,
  topLevel = false,
): asserts feature is FeatureJSON {
  if (
    typeof feature !== 'object' ||
    feature === null ||
    Array.isArray(feature)
  ) {
    throw new TypeError(
      `Feature is not a key-value record: '${JSON.stringify(feature)}'`,
    )
  }
  for (const attribute of ['min', 'max', 'type']) {
    if (!(attribute in feature)) {
      throw new Error(
        `Feature does not contain "${attribute}": '${JSON.stringify(feature)}'`,
      )
    }
  }
  if (topLevel && !('refSeq' in feature)) {
    throw new Error(
      `Top-level feature does not contain "refSeq": '${JSON.stringify(feature)}'`,
    )
  }
  if ('children' in feature) {
    const { children } = feature
    if (!Array.isArray(children)) {
      throw new TypeError(
        `"children" is not an array of features '${JSON.stringify(feature)}'`,
      )
    }
    for (const child of children) {
      assertFeatureIsValid(child)
    }
  }
}
