import { Check, type CheckDocument } from '@apollo-annotation/schemas'
import { makeUserSessionId } from '@apollo-annotation/shared'
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import merge from 'deepmerge'
import { Model } from 'mongoose'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { RefSeqsService } from '../refSeqs/refSeqs.service.js'
import { Role } from '../utils/role/role.enum.js'

import {
  type JBrowseAssemblyConfig,
  type JBrowseFileConfig,
  JBrowseConfigService,
} from './jbrowseConfig.service.js'

/** The subset of a decoded auth JWT needed to generate a user's config. */
export interface JBrowseConfigUser {
  id: string
  iat: number
  role?: Role
}

/**
 * Assembly identity is scoped to (configId, name), since JBrowse only
 * guarantees `name` is unique within a single config file - see the
 * compound unique index on the Assembly schema.
 */
function assemblyKey(configId: string, name: string): string {
  return `${configId}\0${name}`
}

@Injectable()
export class JBrowseService implements OnApplicationBootstrap {
  constructor(
    private readonly assembliesService: AssembliesService,
    private readonly refSeqsService: RefSeqsService,
    private readonly jbrowseConfigService: JBrowseConfigService,
    @InjectModel(Check.name)
    private readonly checkModel: Model<CheckDocument>,
    private readonly configService: ConfigService<
      {
        URL: string
        PLUGIN_LOCATION?: string
        FEATURE_TYPE_ONTOLOGY_LOCATION?: string
        SKIPPED_ATTRIBUTES_ON_COPY?: string
      },
      true
    >,
  ) {}

  private readonly logger = new Logger(JBrowseService.name)

  async onApplicationBootstrap() {
    const configs = await this.jbrowseConfigService.readAllJBrowseFileConfigs()

    const configAssemblyKeys = new Set<string>()
    for (const [configId, config] of configs.entries()) {
      for (const assemblyConfig of config.assemblies ?? []) {
        await this.addAssemblyFromConfig(assemblyConfig, configId)
        configAssemblyKeys.add(assemblyKey(configId, assemblyConfig.name))
      }
    }

    const storedAssemblies = await this.assembliesService.findAll()
    for (const storedAssembly of storedAssemblies) {
      if (
        !configAssemblyKeys.has(
          assemblyKey(storedAssembly.configId, storedAssembly.name),
        )
      ) {
        this.logger.warn(
          `Assembly "${storedAssembly.name}" (configId "${storedAssembly.configId}") was found in MongoDB but not in any configured config.json - it may be orphaned`,
        )
      }
    }
  }

  private async addAssemblyFromConfig(
    assemblyConfig: JBrowseAssemblyConfig,
    configId: string,
  ): Promise<void> {
    const { name: assemblyName, sequence } = assemblyConfig
    const existingAssembly = await this.assembliesService.findByNameAndConfig(
      assemblyName,
      configId,
    )
    if (existingAssembly) {
      this.logger.debug(
        `Assembly "${assemblyName}" already exists for configId "${configId}", so not adding`,
      )
      return
    }
    const sequenceAdapter = this.jbrowseConfigService.buildSequenceAdapter(
      assemblyName,
      sequence,
      configId,
    )
    const allSequenceSizes = await sequenceAdapter.getSequenceSizes()

    const checkDocs = await this.checkModel.find({ isDefault: true }).exec()
    const checks = checkDocs.map((checkDoc) => checkDoc._id.toHexString())

    const assemblyDoc = await this.assembliesService.create({
      name: assemblyName,
      configId,
      checks,
    })
    this.logger.log(
      `Added JBrowse assembly "${assemblyName}" from config.json, docId "${assemblyDoc._id.toHexString()}"`,
    )

    this.logger.log(
      `Adding ${Object.keys(allSequenceSizes).length} refSeqs to assembly "${assemblyName}"`,
    )
    for (const sequenceName in allSequenceSizes) {
      const length = allSequenceSizes[sequenceName]
      if (length === undefined) {
        throw new Error(`No sequence size found for "${sequenceName}"`)
      }
      const newRefSeqDoc = await this.refSeqsService.create({
        name: sequenceName,
        assembly: assemblyDoc._id.toString(),
        length,
      })
      this.logger.debug(
        `Added new refSeq "${sequenceName}", docId "${newRefSeqDoc.id}"`,
      )
    }
  }

  getConfiguration(user?: JBrowseConfigUser) {
    const feature_type_ontology_location =
      this.configService.get('FEATURE_TYPE_ONTOLOGY_LOCATION', {
        infer: true,
      }) ?? 'sequence_ontology.json'
    const skippedAttributesOnCopy = this.getSkippedAttributesOnCopy()
    const configuration = {
      theme: {
        palette: {
          primary: {
            main: '#0c4f4b',
          },
          secondary: {
            main: '#1AA39B',
          },
          tertiary: {
            main: '#4f0c10',
          },
          quaternary: {
            main: '#571AA3',
          },
          framesCDS: [
            null,
            { main: 'rgb(204,121,167)' },
            { main: 'rgb(230,159,0)' },
            { main: 'rgb(240,228,66)' },
            { main: 'rgb(86,180,233)' },
            { main: 'rgb(0,114,178)' },
            { main: 'rgb(0,158,115)' },
          ],
        },
      },
      ApolloPlugin: {
        hasRole: false,
        skippedAttributesOnCopy,
      },
    }
    if (!user) {
      return configuration
    }
    const { id, role } = user
    const userSessionId = makeUserSessionId(user)
    if (!role || role === Role.None) {
      return {
        ...configuration,
        ApolloPlugin: {
          hasRole: true,
          skippedAttributesOnCopy,
          role,
          userId: id,
          userSessionId,
        },
      }
    }
    return {
      ...configuration,
      ApolloPlugin: {
        hasRole: true,
        skippedAttributesOnCopy,
        role,
        userId: id,
        userSessionId,
        ontologies: [
          {
            name: 'Sequence Ontology',
            source: {
              uri: feature_type_ontology_location,
              locationType: 'UriLocation',
            },
          },
        ],
      },
    }
  }

  getSkippedAttributesOnCopy() {
    const skippedAttributes = this.configService.get(
      'SKIPPED_ATTRIBUTES_ON_COPY',
      {
        infer: true,
      },
    )
    return (skippedAttributes ?? '')
      .split(',')
      .map((attribute) => attribute.trim())
      .filter(Boolean)
  }

  getPlugins() {
    const pluginLocation =
      this.configService.get('PLUGIN_LOCATION', { infer: true }) ?? 'apollo.js'
    return [
      {
        name: 'Apollo',
        url: pluginLocation,
      },
    ]
  }

  getDefaultSession() {
    return {
      name: 'Apollo',
      views: [{ type: 'LinearGenomeView' }],
    }
  }

  async getTracks(fileConfig: JBrowseFileConfig, configId: string) {
    const url = this.configService.get('URL', { infer: true })
    const allowedAssemblyNames = new Set(
      (fileConfig.assemblies ?? []).map(
        (assemblyConfig) => assemblyConfig.name,
      ),
    )
    const allAssemblies = await this.assembliesService.findAll()
    const assemblies = allAssemblies.filter(
      (assembly) =>
        assembly.configId === configId &&
        allowedAssemblyNames.has(assembly.name),
    )
    return assemblies.map((assembly) => {
      const trackId = `apollo_track_${assembly.id}`
      return {
        type: 'ApolloTrack',
        trackId,
        name: `Annotations (${assembly.name})`,
        assemblyNames: [assembly.id],
        textSearching: {
          textSearchAdapter: {
            type: 'ApolloTextSearchAdapter',
            trackId,
            assemblyNames: [assembly.id],
            textSearchAdapterId: `apollo_search_${assembly.id}`,
            baseURL: {
              uri: url,
              locationType: 'UriLocation',
            },
          },
        },
      }
    })
  }

  async getConfig(user?: JBrowseConfigUser, configId?: string) {
    const fileName = this.jbrowseConfigService.resolveConfigFileName(configId)
    const fileConfig =
      await this.jbrowseConfigService.readJBrowseFileConfig(fileName)
    if (!user?.role || user.role === Role.None) {
      return {
        configuration: this.getConfiguration(user),
        plugins: this.getPlugins(),
      }
    }
    const generatedConfig = {
      configuration: this.getConfiguration(user),
      tracks: await this.getTracks(fileConfig, fileName),
      plugins: this.getPlugins(),
      defaultSession: this.getDefaultSession(),
    }
    return merge(generatedConfig, fileConfig)
  }
}
