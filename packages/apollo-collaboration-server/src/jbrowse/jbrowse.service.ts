import { Injectable, Logger } from '@nestjs/common'

import { AssembliesService } from '../assemblies/assemblies.service'
import { RefSeqsService } from '../refSeqs/refSeqs.service'

@Injectable()
export class JBrowseService {
  constructor(
    private readonly assembliesService: AssembliesService,
    private readonly refSeqsService: RefSeqsService,
  ) {}

  private readonly logger = new Logger(JBrowseService.name)

  async getConfig() {
    const assemblies = await this.assembliesService.findAll()
    const config = this.getDefaultConfig()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assemblyConfigs: any[] = []
    config.assemblies = assemblyConfigs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trackConfigs: any[] = []
    config.tracks = trackConfigs

    for (const assembly of assemblies) {
      const refSeqs = await this.refSeqsService.findAll({
        assembly: assembly._id.toHexString(),
      })
      const ids: Record<string, string> = {}
      const refNameAliasesFeatures = refSeqs.map((refSeq) => {
        ids[refSeq.name] = refSeq._id
        return {
          refName: refSeq.name,
          aliases: [refSeq._id],
          uniqueId: `alias-${refSeq._id}`,
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const assemblyConfig: any = {
        name: assembly._id,
        aliases: [assembly.name, ...(assembly.aliases ?? [])],
        displayName: assembly.displayName ?? assembly.name,
        sequence: {
          trackId: `sequenceConfigId-${assembly.name}`,
          type: 'ReferenceSequenceTrack',
          adapter: {
            type: 'ApolloSequenceAdapter',
            assemblyId: assembly._id,
            baseURL: {
              uri: 'http://localhost:3999',
              locationType: 'UriLocation',
            },
          },
          metadata: {
            apollo: true,
            internetAccountConfigId: 'apolloInternetAccount',
            // internetAccountConfigId: configuration.internetAccountId,
            ids,
          },
        },
        refNameAliases: {
          adapter: {
            type: 'FromConfigAdapter',
            features: refNameAliasesFeatures,
          },
        },
      }
      assemblyConfigs.push(assemblyConfig)

      // Tracks
      const trackId = `apollo_track_${assembly.id}`
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const trackConfig: any = {
        type: 'ApolloTrack',
        trackId,
        name: `Annotations (${assembly.displayName ?? assembly.name})`,
        assemblyNames: [assembly.id],
        textSearching: {
          textSearchAdapter: {
            type: 'ApolloTextSearchAdapter',
            trackId,
            assemblyNames: [assembly.id],
            textSearchAdapterId: `apollo_search_${assembly.id}`,
            baseURL: {
              uri: 'http://localhost:3999',
              locationType: 'UriLocation',
            },
          },
        },
        displays: [
          {
            type: 'LinearApolloDisplay',
            displayId: `${trackId}-LinearApolloDisplay`,
          },
          {
            type: 'SixFrameFeatureDisplay',
            displayId: `${trackId}-SixFrameFeatureDisplay`,
          },
        ],
      }
      trackConfigs.push(trackConfig)
    }
    // console.log(`TRACK CONFIGS = ${JSON.stringify(trackConfigs)}`)
    return config
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDefaultConfig(): any {
    return {
      assemblies: [],
      tracks: [],
      configuration: {
        theme: {
          palette: {
            primary: {
              main: '#24264a',
            },
            secondary: {
              main: '#6f8fa2',
            },
            tertiary: {
              main: '#1e4b34',
            },
            quaternary: {
              main: '#6b4e2b',
            },
          },
        },
        ApolloPlugin: {
          ontologies: [
            {
              name: 'Gene Ontology',
              version: 'full',
              source: {
                uri: 'https://release.geneontology.org/2023-06-11/ontology/go.json',
                locationType: 'UriLocation',
              },
            },
            {
              name: 'Sequence Ontology',
              version: '3.1',
              source: {
                uri: 'test_data/so-v3.1.json',
                locationType: 'UriLocation',
              },
            },
          ],
        },
      },
      plugins: [
        {
          name: 'Apollo',
          url: 'http://localhost:9000/dist/jbrowse-plugin-apollo.umd.development.js',
        },
      ],

      internetAccounts: [
        {
          type: 'ApolloInternetAccount',
          internetAccountId: 'apolloInternetAccount',
          name: 'Demo Server',
          description:
            'A server hosting a small fictional organism to demonstrate Apollo capabilities',
          domains: ['localhost:3999'],
          baseURL: 'http://localhost:3999',
        },
      ],
      defaultSession: {
        name: 'Apollo Demo',
        views: [
          {
            type: 'LinearGenomeView',
          },
        ],
      },
    }
  }
}
