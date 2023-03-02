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
  parentType: string
}

export class GetOntologyTermsOperation extends Operation {
  typeName = 'GetOntologyTermsOperation' as const
  parentType: string

  constructor(
    json: SerializedGetOntologyTermsOperation,
    options?: OperationOptions,
  ) {
    super(json, options)
    this.parentType = json.parentType
  }

  toJSON(): SerializedGetOntologyTermsOperation {
    const { typeName, parentType } = this
    return { typeName, parentType }
  }

  async executeOnServer(backend: ServerDataStore) {
    const { parentType } = this
    const { ontology } = backend
    return this.getPossibleChildTypes(parentType, ontology)
  }

  async executeOnLocalGFF3(backend: LocalGFF3DataStore) {
    throw new Error('executeOnLocalGFF3 not implemented')
  }

  /**
   * Get all possible feature types for given parent type. Data is retrieved from OBO JSON file
   * @param parentType - parent feature type
   * @returns String array of possible children types
   */
  async getPossibleChildTypes(
    parentType: string,
    ontology: OboJson,
  ): Promise<string[]> {
    let parentId: string | undefined = undefined
    const { logger } = this

    // Iterate over the nodes and edges in the JSON file
    for (const node of ontology.graphs[0].nodes) {
      if (node.lbl === parentType) {
        logger.debug?.(
          `Parent type is "${parentType}", OboJson node is "${node.id}"`,
        )
        parentId = node.id
        break
      }
    }
    if (!parentId) {
      throw new Error(`Term "${parentType}" not found in ontology`)
    }

    // Get all (recursively) those nodes that have "is_a" relation from parentNode
    const parentAndEquivalents = this.getEquivalentTypes(parentId, ontology)

    const partOfAndEquivalents = this.getEquivalentTypes(
      'http://purl.obolibrary.org/obo/so#part_of',
      ontology,
      undefined,
      'subPropertyOf',
    )

    const children: Set<string> = new Set()
    // Loop edges and save those nodes that have either "part_of" or "member_of" relation from any previously fetched "is_A" -nodes
    for (const edge of ontology.graphs[0].edges) {
      if (
        parentAndEquivalents.has(edge.obj) &&
        partOfAndEquivalents.has(edge.pred)
      ) {
        children.add(edge.sub)
      }
    }

    const childrenAndEquivalents: Set<string> = new Set()
    for (const child of children) {
      this.getEquivalentTypes(child, ontology, childrenAndEquivalents)
    }

    return ontology.graphs[0].nodes
      .filter((node) => childrenAndEquivalents.has(node.id))
      .map((node) => node.lbl)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
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
    const equivalentTypes: Set<string> = existingTypes || new Set()
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
