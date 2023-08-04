import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
  isUriLocation,
} from '@jbrowse/core/util'
import { IDBPTransaction, IndexNames, StoreNames } from 'idb/with-async-ittr'

import { getTermsByFulltext } from './fulltext'
import { OntologyDB, OntologyDBEdge, isDeprecated } from './indexeddb-schema'
import {
  getTextIndexPaths,
  isDatabaseCurrent,
  loadOboGraphJson,
  openDatabase,
} from './indexeddb-storage'
import {
  OntologyClass,
  OntologyProperty,
  OntologyTerm,
  isOntologyClass,
  isOntologyProperty,
} from '..'

export type SourceLocation = UriLocation | LocalPathLocation | BlobLocation

/** type alias for a Transaction on this particular DB schema */
export type Transaction<
  TxStores extends ArrayLike<StoreNames<OntologyDB>> = ArrayLike<
    StoreNames<OntologyDB>
  >,
  Mode extends IDBTransactionMode = 'readonly',
> = IDBPTransaction<OntologyDB, TxStores, Mode>

/** the format of the loading data source */
type SourceType = 'obo-graph-json' | 'obo' | 'owl'

/**
 * @deprecated use the one from jbrowse core when it is published
 **/
function isLocalPathLocation(location: unknown): location is LocalPathLocation {
  return (
    typeof location === 'object' && location !== null && 'localPath' in location
  )
}

async function arrayFromAsync<T>(iter: AsyncIterable<T>) {
  const a = []
  for await (const i of iter) {
    a.push(i)
  }
  return a
}

// /**
//  * @deprecated use the one from jbrowse core when it is published
//  */
// function isBlobLocation(location: unknown): location is BlobLocation {
//   return (
//     typeof location === 'object' && location !== null && 'blobId' in location
//   )
// }

export interface OntologyStoreOptions {
  prefixes?: Map<string, string>
  textIndexing?: {
    /** json paths of paths in the nodes to index as full text */
    indexPaths?: string[]
  }
  maxSearchResults?: number
}

/** query interface for a specific ontology */
export default class OntologyStore {
  ontologyName: string
  ontologyVersion: string
  sourceLocation: SourceLocation
  db: ReturnType<OntologyStore['prepareDatabase']>
  options: OntologyStoreOptions

  loadOboGraphJson = loadOboGraphJson
  getTermsByFulltext = getTermsByFulltext
  openDatabase = openDatabase
  isDatabaseCurrent = isDatabaseCurrent

  get textIndexPaths() {
    return getTextIndexPaths.call(this)
  }

  get prefixes(): Map<string, string> {
    return this.options.prefixes ?? new Map()
  }

  readonly DEFAULT_MAX_SEARCH_RESULTS = 100

  constructor(
    name: string,
    version: string,
    source: SourceLocation,
    options?: OntologyStoreOptions,
  ) {
    this.ontologyName = name
    this.ontologyVersion = version
    this.sourceLocation = source
    this.db = this.prepareDatabase()
    this.options = options ?? {}
  }

  /**
   * check that the configuration of this ontology appears valid. Does not
   * try to do any fetches, however.
   */
  validate() {
    const errors = []

    // validate the source's file type
    const { sourceType } = this
    if (!sourceType) {
      errors.push(
        new Error(
          `unable to determine format of ontology source file ${JSON.stringify(
            this.sourceLocation,
          )}, file name must end with ".json", ".obo", or ".owl"`,
        ),
      )
    } else if (sourceType !== 'obo-graph-json') {
      errors.push(
        new Error(
          `ontology source file ${JSON.stringify(
            this.sourceLocation,
          )} has type ${sourceType}, which is not yet supported`,
        ),
      )
    }

    return errors
  }

  get sourceType(): SourceType | undefined {
    if (isUriLocation(this.sourceLocation)) {
      if (this.sourceLocation.uri.endsWith('.json')) {
        return 'obo-graph-json'
      }
    } else if (isLocalPathLocation(this.sourceLocation)) {
      if (this.sourceLocation.localPath.endsWith('.json')) {
        return 'obo-graph-json'
      }
    }
    return undefined
  }

  /** base name of the IndexedDB database for this ontology */
  get dbName() {
    return `Apollo Ontology "${this.ontologyName}" "${this.ontologyVersion}"`
  }

  async prepareDatabase() {
    const errors = this.validate()
    if (errors.length) {
      throw errors
    }

    const db = await this.openDatabase(this.dbName)

    // if database is already completely loaded, just return it
    if (await this.isDatabaseCurrent(db)) {
      return db
    }

    const { sourceType } = this
    if (sourceType === 'obo-graph-json') {
      await this.loadOboGraphJson(db)
    } else {
      throw new Error(
        `ontology source file ${JSON.stringify(
          this.sourceLocation,
        )} has type ${sourceType}, which is not yet supported`,
      )
    }

    return db
  }

  async termCount(tx?: Transaction<['nodes']>) {
    const myTx = tx ?? (await this.db).transaction('nodes')
    return myTx.objectStore('nodes').count()
  }

  private async unique<ITEM extends { id: string }>(nodes: ITEM[]) {
    const seen = new Map<string, boolean>()
    const result: ITEM[] = []
    for (const node of nodes) {
      if (!seen.has(node.id)) {
        seen.set(node.id, true)
        result.push(node)
      }
    }
    return result
  }

  async getTermsWithLabelOrSynonym(
    termLabelOrSynonym: string,
    options?: { includeSubclasses?: boolean },
    tx?: Transaction<['nodes', 'edges']>,
  ): Promise<OntologyTerm[]> {
    const includeSubclasses = options?.includeSubclasses ?? true
    const myTx = tx ?? (await this.db).transaction(['nodes', 'edges'])
    const nodes = myTx.objectStore('nodes')
    const resultNodes = (
      await nodes.index('by-label').getAll(termLabelOrSynonym)
    ).concat(await nodes.index('by-synonym').getAll(termLabelOrSynonym))

    if (includeSubclasses) {
      // now recursively traverse is_a relations to gather nodes that are subclasses any of these
      const subclassIds = await this.recurseEdges(
        'by-object',
        resultNodes.map((n) => n.id),
        (edge) => edge.pred === 'is_a',
        'sub',
        myTx as unknown as Transaction<['edges']>,
      )
      for (const nodeId of subclassIds) {
        const node = await nodes.get(nodeId)
        if (node) {
          resultNodes.push(node)
        }
      }
    }

    return resultNodes
  }

  /**
   * Get the ontology term for the property with the given label,
   * plus all the terms for the properties that are "subPropertyOf"
   * that property.
   *
   * If there is more than one property with that label, treats it as
   * equivalent and just returns all the properties and their subproperties.
   *
   * options.includeSubProperties default is true
   */
  async getPropertiesByLabel(
    propertyLabel: string,
    options?: { includeSubProperties?: boolean },
    tx?: Transaction<['nodes', 'edges']>,
  ): Promise<OntologyProperty[]> {
    const includeSubProperties = options?.includeSubProperties ?? true

    const myTx = tx ?? (await this.db).transaction(['nodes', 'edges'])

    const properties = (
      await this.getTermsWithLabelOrSynonym(
        propertyLabel,
        { includeSubclasses: false },
        myTx,
      )
    ).filter((p): p is OntologyProperty => isOntologyProperty(p))

    if (includeSubProperties) {
      const subPropertyIds = await this.recurseEdges(
        'by-object',
        properties.map((p) => p.id),
        (edge) => edge.pred === 'subPropertyOf',
        'sub',
        myTx as unknown as Transaction<['edges']>,
      )

      const nodes = myTx.objectStore('nodes')
      for (const subPropertyId of subPropertyIds) {
        const property = await nodes.get(subPropertyId)
        if (property && isOntologyProperty(property)) {
          properties.push(property)
        }
      }
    }

    return properties
  }

  /** private helper for traversing the edges of the ontology graph. Does a breadth-first search of the graph */
  private async recurseEdges(
    queryIndex: IndexNames<OntologyDB, 'edges'>,
    inputQueryIds: Iterable<string>,
    filterEdge: (edge: OntologyDBEdge) => boolean,
    resultProp: 'sub' | 'obj',
    myTx: Transaction<['edges']>,
  ) {
    const resultIds = new Set<string>()

    async function recur(queryIds: Iterable<string>) {
      await Promise.all(
        Array.from(queryIds).map(async (queryId) => {
          const theseResults = (
            (await myTx
              .objectStore('edges')
              .index(queryIndex)
              .getAll(queryId)) as OntologyDBEdge[]
          )
            .filter(filterEdge)
            .map((edge) => edge[resultProp])

          if (theseResults.length) {
            // report these subjects as results
            for (const resultId of theseResults) {
              resultIds.add(resultId)
            }

            // and now recurse further through the edges
            await recur(theseResults)
          }
        }),
      )
    }

    await recur(inputQueryIds)
    return resultIds.values()
  }

  /**
   * given an array of node IDs, augment it with all of their subclasses or
   * superclasses, and return the augmented array
   **/
  private async *expandNodeSet(
    startingNodeIds: Iterable<string>,
    subclassRelation = 'is_a',
    direction: 'superclasses' | 'subclasses',
    tx?: Transaction<['edges']>,
  ) {
    const myTx = tx ?? (await this.db).transaction(['edges'])
    const startingNodes = Array.from(startingNodeIds)
    const subclassIds = await this.recurseEdges(
      direction === 'subclasses' ? 'by-object' : 'by-subject',
      startingNodes,
      (edge) => edge.pred === subclassRelation,
      direction === 'subclasses' ? 'sub' : 'obj',
      myTx as unknown as Transaction<['edges']>,
    )
    for (const n of startingNodes) {
      yield n
    }
    for (const id of subclassIds) {
      yield id
    }
  }

  /**
   * given an iterator of node IDs, return a new iterator of those nodes plus all of their subclasses
   */
  expandSubclasses(
    startingNodeIds: Iterable<string>,
    subclassRelation = 'is_a',
    tx?: Transaction<['edges']>,
  ) {
    return this.expandNodeSet(
      startingNodeIds,
      subclassRelation,
      'subclasses',
      tx,
    )
  }

  /**
   * given an iterator of node IDs, return a new iterator of those nodes plus all of their superclasses
   */
  expandSuperclasses(
    startingNodeIds: Iterable<string>,
    subclassRelation = 'is_a',
    tx?: Transaction<['edges']>,
  ) {
    return this.expandNodeSet(
      startingNodeIds,
      subclassRelation,
      'superclasses',
      tx,
    )
  }

  /**
   * example: for the Sequence Ontology, store.getTermsThat('part_of', [geneTerm])
   * would return all terms that are part_of, member_of, or integral_part_of a gene
   */
  async getClassesThat(
    propertyLabel: string,
    targetTerms: OntologyClass[],
    tx?: Transaction<['nodes', 'edges']>,
  ) {
    const myTx = tx ?? (await this.db).transaction(['nodes', 'edges'])

    // find all the terms for the properties we are using
    const relatingProperties = await this.getPropertiesByLabel(
      propertyLabel,
      { includeSubProperties: true },
      myTx,
    )
    const relatingPropertyIds = relatingProperties.map((p) => p.id)

    // expand to search all the superclasses of the target terms
    const targetTermsWithSuperClasses = await arrayFromAsync(
      this.expandSuperclasses(
        targetTerms.map((t) => t.id),
        'is_a',
        myTx as unknown as Transaction<['edges']>,
      ),
    )

    // these are all the terms that are related to the targets by the given properties
    const termIds = await this.recurseEdges(
      'by-object',
      targetTermsWithSuperClasses,
      (edge) => relatingPropertyIds.includes(edge.pred),
      'sub',
      myTx as unknown as Transaction<['edges']>,
    )

    // expand to include all the subclasses of those terms
    const expanded = this.expandSubclasses(
      termIds,
      'is_a',
      myTx as unknown as Transaction<['edges']>,
    )

    // fetch the full nodes and filter out deprecated ones
    const terms: OntologyClass[] = []
    for await (const termId of expanded) {
      const node = await myTx.objectStore('nodes').get(termId)
      if (node && isOntologyClass(node) && !isDeprecated(node)) {
        terms.push(node)
      }
    }

    return terms
  }

  async getClassesWithoutPropertyLabeled(
    propertyLabel: string,
    options = { includeSubProperties: false },
    tx?: Transaction<['nodes', 'edges']>,
  ) {
    const myTx = tx ?? (await this.db).transaction(['nodes', 'edges'])
    const nodeStore = myTx.objectStore('nodes')
    const edgeStore = myTx.objectStore('edges')

    // find all the terms (synonyms, subterms, etc) for the properties we are using
    const relatingProperties = await this.getPropertiesByLabel(
      propertyLabel,
      options,
      myTx,
    )
    const relatingPropertyIds = relatingProperties.map((p) => p.id)

    // make a blacklist of all the term IDs that have those properties, plus their subclasses
    const termIdsWithProperties = await (async () => {
      const ids = new Set<string>()
      for (const propertyId of relatingPropertyIds) {
        for await (const cursor of edgeStore
          .index('by-predicate')
          .iterate(propertyId)) {
          ids.add(cursor.value.sub)
        }
      }
      // expand their subclasses
      const expanded = new Set<string>()
      for await (const id of this.expandSubclasses(
        ids,
        'is_a',
        myTx as unknown as Transaction<['edges']>,
      )) {
        expanded.add(id)
      }
      return expanded
    })()

    // iterate through all terms in the store, find ones that are CLASS
    // and are not in the blacklist
    const termIds: string[] = []
    for await (const cursor of nodeStore) {
      const node = cursor.value
      if (isOntologyClass(node) && !termIdsWithProperties.has(node.id)) {
        termIds.push(node.id)
      }
    }

    // fetch the full nodes and filter out deprecated ones
    const terms: OntologyClass[] = []
    for await (const termId of termIds) {
      const node = await myTx.objectStore('nodes').get(termId)
      if (node && isOntologyClass(node) && !isDeprecated(node)) {
        terms.push(node)
      }
    }

    return terms
  }

  async getAllClasses(tx?: Transaction<['nodes']>): Promise<OntologyClass[]> {
    const myTx = tx ?? (await this.db).transaction(['nodes'])
    const all = (await myTx
      .objectStore('nodes')
      .index('by-type')
      .getAll('CLASS')) as OntologyClass[]
    return all.filter((term) => !isDeprecated(term))
  }

  async getAllTerms(tx?: Transaction<['nodes']>): Promise<OntologyTerm[]> {
    const myTx = tx ?? (await this.db).transaction(['nodes'])
    const all = await myTx.objectStore('nodes').getAll()
    return all.filter((term) => !isDeprecated(term))
  }
}
