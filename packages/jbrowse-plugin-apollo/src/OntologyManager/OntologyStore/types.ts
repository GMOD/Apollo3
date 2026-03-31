import type { OntologyDBNode } from './indexeddb-schema'

export type OntologyTerm = OntologyDBNode

export type OntologyClass = OntologyTerm & { type: 'CLASS' }
export function isOntologyClass(term: OntologyTerm): term is OntologyClass {
  return term.type === 'CLASS'
}

export type OntologyProperty = OntologyTerm & { type: 'PROPERTY' }
export function isOntologyProperty(
  term: OntologyTerm,
): term is OntologyProperty {
  return term.type === 'PROPERTY'
}

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
