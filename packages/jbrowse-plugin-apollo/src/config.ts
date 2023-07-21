import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

import { OntologyRecordConfiguration } from './OntologyManager'

const ApolloPluginConfigurationSchema = ConfigurationSchema('ApolloPlugin', {
  ontologies: types.array(OntologyRecordConfiguration),
})

export default ApolloPluginConfigurationSchema
