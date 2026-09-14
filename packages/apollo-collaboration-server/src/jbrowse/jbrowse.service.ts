import fs from 'node:fs/promises'
import path from 'node:path'

import {
  Check,
  type CheckDocument,
  JBrowseAssembly,
  type JBrowseAssemblyDocument,
  JBrowseRefSeq,
  type JBrowseRefSeqDocument,
} from '@apollo-annotation/schemas'
import { BgzipIndexedFasta } from '@gmod/indexedfasta'
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InjectModel } from '@nestjs/mongoose'
import merge from 'deepmerge'
import { RemoteFile } from 'generic-filehandle2'
import { Model } from 'mongoose'

import { AssembliesService } from '../assemblies/assemblies.service.js'
import { resolveJBrowseDir } from '../utils/jbrowse-dir.util.js'
import { Role } from '../utils/role/role.enum.js'

interface JBrowseUriLocation {
  uri: string
}

interface JBrowseSequenceConfig {
  adapter: {
    type: string
    fastaLocation: JBrowseUriLocation
    faiLocation: JBrowseUriLocation
    gziLocation: JBrowseUriLocation
  }
}

interface JBrowseAssemblyConfig {
  name: string
  sequence: JBrowseSequenceConfig
}

interface JBrowseFileConfig {
  assemblies?: JBrowseAssemblyConfig[]
  tracks?: Record<string, unknown>[]
  internetAccounts?: Record<string, unknown>[]
  [key: string]: unknown
}

@Injectable()
export class JBrowseService implements OnApplicationBootstrap {
  constructor(
    private readonly assembliesService: AssembliesService,
    @InjectModel(JBrowseAssembly.name)
    private readonly jbrowseAssemblyModel: Model<JBrowseAssemblyDocument>,
    @InjectModel(JBrowseRefSeq.name)
    private readonly jbrowseRefSeqModel: Model<JBrowseRefSeqDocument>,
    @InjectModel(Check.name)
    private readonly checkModel: Model<CheckDocument>,
    private readonly configService: ConfigService<
      {
        URL: string
        PLUGIN_LOCATION?: string
        FEATURE_TYPE_ONTOLOGY_LOCATION?: string
        SKIPPED_ATTRIBUTES_ON_COPY?: string
        JBROWSE_DIR?: string
        JBROWSE_DEV_SERVER_URL?: string
      },
      true
    >,
  ) {}

  private readonly logger = new Logger(JBrowseService.name)

  /**
   * Reads the JBrowse config.json either off disk (JBROWSE_DIR, the
   * default) or, in the dev-only mode where a JBrowse dev server is running
   * instead of a built bundle on disk, by fetching it from that dev server
   * (JBROWSE_DEV_SERVER_URL). These two are mutually exclusive, enforced by
   * the Joi `.xor` in app.module.ts.
   */
  private async readJBrowseFileConfig(): Promise<JBrowseFileConfig> {
    const devServerUrl = this.configService.get('JBROWSE_DEV_SERVER_URL', {
      infer: true,
    })
    if (devServerUrl) {
      const response = await fetch(new URL('config.json', devServerUrl))
      if (!response.ok) {
        throw new Error(
          `Failed to fetch config.json from JBrowse dev server at "${devServerUrl}": ${response.status} ${response.statusText}`,
        )
      }
      return (await response.json()) as JBrowseFileConfig
    }
    // Guaranteed to be set when JBROWSE_DEV_SERVER_URL isn't (enforced by
    // the Joi `.xor` in app.module.ts).
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jbrowseDir = this.configService.get('JBROWSE_DIR', { infer: true })!
    const configPath = path.join(resolveJBrowseDir(jbrowseDir), 'config.json')
    const contents = await fs.readFile(configPath, 'utf8')
    return JSON.parse(contents) as JBrowseFileConfig
  }

  async onApplicationBootstrap() {
    const config = await this.readJBrowseFileConfig()
    const assemblies = config.assemblies ?? []

    for (const assemblyConfig of assemblies) {
      await this.addAssemblyFromConfig(assemblyConfig)
    }

    const configAssemblyNames = new Set(
      assemblies.map((assemblyConfig) => assemblyConfig.name),
    )
    const storedAssemblies = await this.jbrowseAssemblyModel.find().exec()
    for (const storedAssembly of storedAssemblies) {
      if (!configAssemblyNames.has(storedAssembly.name)) {
        this.logger.warn(
          `Assembly "${storedAssembly.name}" was found in MongoDB but not in config.json - it may be orphaned`,
        )
      }
    }
  }

  private async addAssemblyFromConfig(
    assemblyConfig: JBrowseAssemblyConfig,
  ): Promise<void> {
    const { name: assemblyName, sequence } = assemblyConfig
    const existingAssembly = await this.jbrowseAssemblyModel
      .findOne({ name: assemblyName })
      .exec()
    if (existingAssembly) {
      this.logger.debug(
        `Assembly "${assemblyName}" already exists, so not adding`,
      )
      return
    }
    const { adapter } = sequence
    if (adapter.type !== 'BgzipFastaAdapter') {
      throw new Error(
        `Unsupported sequence adapter type "${adapter.type}" for assembly "${assemblyName}" in config.json`,
      )
    }
    const sequenceAdapter = new BgzipIndexedFasta({
      fasta: new RemoteFile(adapter.fastaLocation.uri, { fetch }),
      fai: new RemoteFile(adapter.faiLocation.uri, { fetch }),
      gzi: new RemoteFile(adapter.gziLocation.uri, { fetch }),
    })
    const allSequenceSizes = await sequenceAdapter.getSequenceSizes()

    const checkDocs = await this.checkModel.find({ isDefault: true }).exec()
    const checks = checkDocs.map((checkDoc) => checkDoc._id.toHexString())

    const [assemblyDoc] = await this.jbrowseAssemblyModel.create([
      { name: assemblyName, checks },
    ])
    if (!assemblyDoc) {
      throw new Error(`Failed to create JBrowse assembly "${assemblyName}"`)
    }
    this.logger.log(
      `Added JBrowse assembly "${assemblyName}" from config.json, docId "${assemblyDoc._id.toHexString()}"`,
    )

    this.logger.log(
      `Adding ${Object.keys(allSequenceSizes).length} refSeqs to assembly "${assemblyName}"`,
    )
    for (const sequenceName in allSequenceSizes) {
      const [newRefSeqDoc] = await this.jbrowseRefSeqModel.create([
        {
          name: sequenceName,
          assembly: assemblyDoc._id,
          length: allSequenceSizes[sequenceName],
        },
      ])
      this.logger.debug(
        `Added new refSeq "${sequenceName}", docId "${newRefSeqDoc?.id}"`,
      )
    }
  }

  getConfiguration(role?: Role) {
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
    if (!role) {
      return configuration
    }
    if (role === Role.None) {
      return {
        ...configuration,
        ApolloPlugin: {
          hasRole: true,
          skippedAttributesOnCopy,
        },
      }
    }
    return {
      ...configuration,
      ApolloPlugin: {
        hasRole: true,
        skippedAttributesOnCopy,
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

  async getTracks() {
    const url = this.configService.get('URL', { infer: true })
    const assemblies = await this.assembliesService.findAll()
    return assemblies.map((assembly) => {
      const trackId = `apollo_track_${assembly.id}`
      return {
        type: 'ApolloTrack',
        trackId,
        name: `Annotations (${assembly.displayName || assembly.name})`,
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

  async getConfig(role?: Role) {
    const fileConfig = await this.readJBrowseFileConfig()
    if (!role || role === Role.None) {
      return merge(
        {
          configuration: this.getConfiguration(role),
          plugins: this.getPlugins(),
        },
        { internetAccounts: fileConfig.internetAccounts ?? [] },
      )
    }
    const generatedConfig = {
      configuration: this.getConfiguration(role),
      tracks: await this.getTracks(),
      plugins: this.getPlugins(),
      defaultSession: this.getDefaultSession(),
    }
    return merge(generatedConfig, fileConfig)
  }
}
