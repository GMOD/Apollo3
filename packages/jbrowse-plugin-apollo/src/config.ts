import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'
import type { Instance, SnapshotIn } from '@jbrowse/mobx-state-tree'

import { OntologyRecordConfiguration } from './OntologyManager'

type OntologyRecordSnapshot = SnapshotIn<typeof OntologyRecordConfiguration>

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
    role: {
      description: "The logged-in user's role",
      type: 'string',
      defaultValue: '',
    },
    userId: {
      description: "The logged-in user's id",
      type: 'string',
      defaultValue: '',
    },
    userSessionId: {
      description:
        "A per-login-session id, used to tell this session's own changes apart from others' when they echo back over the socket",
      type: 'string',
      defaultValue: '',
    },
    skippedAttributesOnCopy: {
      description: 'Feature attribute keys to skip when copying features',
      type: 'stringArray',
      defaultValue: [],
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
      addOntology(ontologySnapshot: OntologyRecordSnapshot) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        self.ontologies.push(ontologySnapshot)
      },
    }),
  },
)

// ConfigurationSchema's typing doesn't carry custom actions through to the
// instance type, so they're added here
export type ApolloPluginConfigModel = Instance<
  typeof ApolloPluginConfigurationSchema
> & {
  addOntology(ontologySnapshot: OntologyRecordSnapshot): void
}

export default ApolloPluginConfigurationSchema
