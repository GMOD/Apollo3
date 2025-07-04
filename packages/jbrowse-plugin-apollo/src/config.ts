import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

import { OntologyRecordConfiguration } from './OntologyManager'

const ApolloPluginConfigurationSchema = ConfigurationSchema('ApolloPlugin', {
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
})

export default ApolloPluginConfigurationSchema
