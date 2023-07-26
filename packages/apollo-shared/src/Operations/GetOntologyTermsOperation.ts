import {
  LocalGFF3DataStore,
  OboJson,
  Operation,
  OperationOptions,
  SerializedOperation,
  ServerDataStore,
} from 'apollo-common'

interface SerializedGetOntologyTermsOperation extends SerializedOperation {
  typeName: 'GetOntologyTermsOperation'
  label: string
  target: 'equivalents' | 'children'
}

export class GetOntologyTermsOperation extends Operation {
  typeName = 'GetOntologyTermsOperation' as const
  label: string
  target: 'equivalents' | 'children'

  constructor(
    json: SerializedGetOntologyTermsOperation,
    options?: OperationOptions,
  ) {
    super(json, options)
    this.label = json.label
    this.target = json.target
  }

  toJSON(): SerializedGetOntologyTermsOperation {
    const { typeName, label, target } = this
    return { typeName, label, target }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { label, target } = this
    const { ontology } = backend
    if (target === 'children') {
      return this.getPossibleChildTypes(label, ontology)
    }
    const id = this.getId(label, ontology)
    const equivalentIds = this.getEquivalentTypes(id, ontology)
    return this.getLabels(equivalentIds, ontology)
  }

  async executeOnLocalGFF3(_backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  getId(label: string, ontology: OboJson) {
    let id: string | undefined = undefined
    const { logger } = this

    // Iterate over the nodes and edges in the JSON file
    for (const node of ontology.graphs[0].nodes) {
      if (node.lbl === label) {
        logger.debug?.(
          `Parent type is "${label}", OboJson node is "${node.id}"`,
        )
        ;({ id } = node)
        break
      }
    }
    if (!id) {
      throw new Error(`Term "${label}" not found in ontology`)
    }
    return id
  }

  getLabels(ids: Set<string>, ontology: OboJson) {
    return ontology.graphs[0].nodes
      .filter((node) => ids.has(node.id))
      .map((node) => node.lbl)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }

  /**
   * Get all possible feature types for given parent type. Data is retrieved from OBO JSON file
   * @param label - parent feature type
   * @returns String array of possible children types
   */
  getPossibleChildTypes(label: string, ontology: OboJson): string[] {
    const parentId = this.getId(label, ontology)
    // Get all (recursively) those nodes that have "is_a" relation from parentNode
    const parentAndEquivalents = this.getEquivalentTypes(parentId, ontology)

    const partOfAndEquivalents = this.getEquivalentTypes(
      'http://purl.obolibrary.org/obo/so#part_of',
      ontology,
      undefined,
      'subPropertyOf',
    )

    const children = new Set<string>()
    // Loop edges and save those nodes that have either "part_of" or "member_of" relation from any previously fetched "is_A" -nodes
    for (const edge of ontology.graphs[0].edges) {
      if (
        parentAndEquivalents.has(edge.obj) &&
        partOfAndEquivalents.has(edge.pred)
      ) {
        children.add(edge.sub)
      }
    }

    const childrenAndEquivalents = new Set<string>()
    for (const child of children) {
      this.getEquivalentTypes(child, ontology, childrenAndEquivalents)
    }

    return this.getLabels(childrenAndEquivalents, ontology)
  }

  /**
   * Loops array of edges and find recursively all nodes which have "is_a" relation starting from parentNode
   * @param featureTypeId - parent node id
   * @returns Array of ids
   */
  getEquivalentTypes(
    featureTypeId: string,
    ontology: OboJson,
    existingTypes?: Set<string>,
    equivalencePredicate = 'is_a',
  ): Set<string> {
    const equivalentTypes: Set<string> = existingTypes ?? new Set()
    equivalentTypes.add(featureTypeId)
    for (const edge of ontology.graphs[0].edges) {
      if (edge.obj === featureTypeId && edge.pred === equivalencePredicate) {
        equivalentTypes.add(edge.sub)
        this.getEquivalentTypes(
          edge.sub,
          ontology,
          equivalentTypes,
          equivalencePredicate,
        )
      }
    }
    return equivalentTypes
  }
}
