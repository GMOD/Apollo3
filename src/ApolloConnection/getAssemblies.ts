import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { apolloFetch } from '../apolloFetch'

interface Organism {
  commonName: string
  id: number
}

interface ApolloError {
  error: string
}

export async function getAssemblies(connectionConfig: AnyConfigurationModel) {
  const response = await apolloFetch(
    connectionConfig.apolloConfig,
    'organism/findAllOrganisms',
  )
  const result = (await response.json()) as Organism[] | ApolloError
  if ('error' in result) {
    throw new Error(result.error)
  }

  const assemblies: any[] = []
  result.forEach(organism => {
    assemblies.push({
      name: organism.commonName,
      sequence: {
        trackId: `${organism.commonName}-${organism.id}`,
        type: 'ReferenceSequenceTrack',
        adapter: {
          type: 'ApolloSequenceAdapter',
          organismName: organism.commonName,
          apolloConfig: connectionConfig.apolloConfig,
        },
        displays: [
          {
            type: 'LinearApolloReferenceSequenceDisplay',
            displayId: `${organism.commonName}-${organism.id}-LinearApolloReferenceSequenceDisplay`,
            apolloConfig: connectionConfig.apolloConfig,
          },
        ],
      },
    })
  })
  return assemblies
}
