import fs from 'fs'
import path from 'path'

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface OboJsonNode {
  id: string
  meta: {
    definition: { val: string; xrefs: string[] }
    comments: string[]
    synonyms: { pred: string; val: string; xrefs: string[] }[]
    basicPropertyValues: { pred: string; val: string }[]
  }
  type: string
  lbl: string
}

interface OboJsonEdge {
  sub: string
  pred: string
  obj: string
}

interface OboJsonMetadata {
  basicPropertyValues: { pred: string; val: string }[]
  version: string
  xrefs?: string[]
  subsets?: string[]
}

interface OboJson {
  graphs: [
    {
      nodes: OboJsonNode[]
      edges: OboJsonEdge[]
      id: string
      meta: OboJsonMetadata
      equivalentNodesSets?: string[]
      logicalDefinitionAxioms?: string[]
      domainRangeAxioms?: string[]
      propertyChainAxioms?: string[]
    },
  ]
}

@Injectable()
export class OntologiesService {
  protected ontology: OboJson
  constructor(
    private readonly configService: ConfigService<
      { ONTOLOGY_FILE: string },
      true
    >,
  ) {
    const ontologyFile = this.configService.get('ONTOLOGY_FILE', {
      infer: true,
    })
    try {
      const ontologyLocation = path.resolve(__dirname, ontologyFile)
      const ontologyText = fs.readFileSync(ontologyLocation, 'utf8')
      const ontologyJson = JSON.parse(ontologyText) as OboJson
      this.ontology = ontologyJson
    } catch (error) {
      this.logger.error('Error loading ontology file')
      throw error
    }
  }

  private readonly logger = new Logger(OntologiesService.name)

  /**
   * Get all possible feature types for given parent type. Data is retrieved from OBO JSON file
   * @param parentType - parent feature type
   * @returns String array of possible children types
   */
  async getPossibleChildTypes(parentType: string) {
    const { ontology } = this
    let parentId: string | undefined = undefined

    // Iterate over the nodes and edges in the JSON file
    for (const node of ontology.graphs[0].nodes) {
      if (node.lbl === parentType) {
        this.logger.debug(
          `Parent type is "${parentType}" and ID in "Node" array is "${node.id}"`,
        )
        parentId = node.id
        break
      }
    }
    if (!parentId) {
      throw new Error(`Term "${parentType}" not found in ontology`)
    }

    // Get all (recursively) those nodes that have "is_a" relation from parentNode
    const parentAndEquivalents = this.getEquivalentTypes(parentId)

    const partOfAndEquivalents = this.getEquivalentTypes(
      'http://purl.obolibrary.org/obo/so#part_of',
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
      this.getEquivalentTypes(child, childrenAndEquivalents)
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
    existingTypes?: Set<string>,
    equivalencePredicate = 'is_a',
  ): Set<string> {
    const equivalentTypes: Set<string> = existingTypes || new Set()
    equivalentTypes.add(featureTypeId)
    for (const edge of this.ontology.graphs[0].edges) {
      if (edge.obj === featureTypeId && edge.pred === equivalencePredicate) {
        equivalentTypes.add(edge.sub)
        this.getEquivalentTypes(edge.sub, equivalentTypes, equivalencePredicate)
      }
    }
    return equivalentTypes
  }
}
