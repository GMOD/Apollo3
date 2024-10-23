import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

export interface TextIndexFieldDefinition {
  /** name to display in the UI for text taken from this field or fields */
  displayName: string
  /** JSONPath of the field(s) */
  jsonPath: string
}
export const defaultTextIndexFields: TextIndexFieldDefinition[] = [
  { displayName: 'Label', jsonPath: '$.lbl' },
  { displayName: 'Synonym', jsonPath: '$.meta.synonyms[*].val' },
  { displayName: 'Definition', jsonPath: '$.meta.definition.val' },
]

export const OntologyRecordConfiguration = ConfigurationSchema(
  'OntologyRecord',
  {
    name: {
      type: 'string',
      description: 'the full name of the ontology, e.g. "Gene Ontology"',
      defaultValue: 'My Ontology',
    },
    version: {
      type: 'string',
      description: "the ontology's version string",
      defaultValue: 'unversioned',
    },
    source: {
      type: 'fileLocation',
      description: "the download location for the ontology's source file",
      defaultValue: {
        locationType: 'UriLocation',
        uri: 'http://example.com/myontology.json',
      },
    },
    textIndexFields: {
      type: 'frozen',
      description:
        'JSON paths for text fields that will be indexed for text searching',
      defaultValue: defaultTextIndexFields,
    },
  },
  { explicitlyTyped: true },
)

const ApolloPluginConfigurationSchema = ConfigurationSchema(
  'ApolloPlugin',
  {
    ontologies: types.array(OntologyRecordConfiguration),
    featureTypeOntologyName: {
      description: 'Name of the feature type ontology',
      type: 'string',
      defaultValue: 'Sequence Ontology',
    },
  },
  { explicitlyTyped: true },
)

export default ApolloPluginConfigurationSchema
