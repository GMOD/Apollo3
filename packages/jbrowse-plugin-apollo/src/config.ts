import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { OntologyRecordConfiguration } from './OntologyManager'

const ApolloPluginConfigurationSchema = ConfigurationSchema(
  'ApolloPlugin',
  {
    ontologies: types.array(OntologyRecordConfiguration),
    featureTypeOntologyName: {
      description: 'Name of the feature type ontology',
      type: 'string',
      defaultValue: 'Sequence Ontology',
    },
    hasRole: {
      description: 'Flag used internally by jbrowse-plugin-apollo',
      type: 'boolean',
      defaultValue: false,
    },
    geneBackgroundColor: {
      description: 'Color for feature background',
      type: 'string',
      defaultValue: 'jexl:geneBackgroundColor(featureType)',
      contextVariable: ['featureType'],
    },
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: (self: any) => ({
      addOntology(ontologySnapshot: { name: string }) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        self.ontologies.push(ontologySnapshot)
      },
    }),
  },
)

export default ApolloPluginConfigurationSchema
