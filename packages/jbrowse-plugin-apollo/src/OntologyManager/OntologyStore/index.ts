import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
  isUriLocation,
} from '@jbrowse/core/util'
import { IDBPTransaction } from 'idb'

import { OntologyDB } from './indexeddb-schema'
import {
  isDatabaseCompletelyLoaded,
  loadOboGraphJson,
  openDatabase,
} from './indexeddb-storage'

export type SourceLocation = UriLocation | LocalPathLocation | BlobLocation

type SourceType = 'obo-graph-json' | 'obo' | 'owl'

/**
 * @deprecated use the one from jbrowse core when it is published
 **/
function isLocalPathLocation(location: unknown): location is LocalPathLocation {
  return (
    typeof location === 'object' && location !== null && 'localPath' in location
  )
}

/**
 * @deprecated use the one from jbrowse core when it is published
 */
function isBlobLocation(location: unknown): location is BlobLocation {
  return (
    typeof location === 'object' && location !== null && 'blobId' in location
  )
}

/** query interface for a specific ontology */
export default class OntologyStore {
  ontologyName: string
  ontologyVersion: string
  sourceLocation: SourceLocation
  db: ReturnType<OntologyStore['prepareDatabase']>

  constructor(name: string, version: string, source: SourceLocation) {
    this.ontologyName = name
    this.ontologyVersion = version
    this.sourceLocation = source
    this.db = this.prepareDatabase()
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

    const db = await openDatabase(this.dbName)

    // if database is already completely loaded, just return it
    if (await isDatabaseCompletelyLoaded(db)) {
      return db
    }

    const { sourceType } = this
    if (sourceType === 'obo-graph-json') {
      await loadOboGraphJson(this, db)
    } else {
      throw new Error(
        `ontology source file ${JSON.stringify(
          this.sourceLocation,
        )} has type ${sourceType}, which is not yet supported`,
      )
    }

    return db
  }

  async nodeStore(tx?: IDBPTransaction<OntologyDB, ['nodes']>) {
    return (tx || (await this.db).transaction('nodes')).objectStore('nodes')
  }

  async nodeCount(tx?: IDBPTransaction<OntologyDB, ['nodes']>) {
    const nodes = await this.nodeStore(tx)
    return nodes.count()
  }

  async getTermsWithLabelOrSynonym(
    termLabelOrSynonym: string,
    tx?: IDBPTransaction<OntologyDB, ['nodes']>,
  ) {
    const nodes = await this.nodeStore(tx)
    const labeled = nodes.index('by-label').getAll(termLabelOrSynonym)
    const synonymed = await nodes.index('by-synonym').getAll(termLabelOrSynonym)
    return (await labeled).concat(synonymed)
  }

  async getValidPartsOf(termId: string) {
    return
  }

  async getPropertyAndSubPropertiesByLabel(propertyLabel: string) {
    const tx = (await this.db).transaction(['nodes', 'edges'])
    const edges = tx.objectStore('edges')
    const nodes = tx.objectStore('nodes')
    const mainProperties = (
      await this.getTermsWithLabelOrSynonym(
        propertyLabel,
        tx as unknown as IDBPTransaction<OntologyDB, ['nodes']>,
      )
    ).filter((t) => t.type === 'PROPERTY')
    const allProperties = (
      await Promise.all(
        mainProperties.map(async (propertyNode) => {
          const subPropertyIds = (
            await edges.index('by-object').getAll(propertyNode.id)
          )
            .filter((p) => p.pred === 'subPropertyOf')
            .map((p) => p.sub)
            .filter((id) => !!id) as string[]
          const subPropertyTerms = await Promise.all(
            subPropertyIds.map((id) => nodes.get(id)),
          )
          return subPropertyTerms
        }),
      )
    )
      .flat()
      .filter((n) => !!n)

    return allProperties as unknown as Node[]
  }

  async getAllTerms() {
    const all = await (await this.nodeStore()).index('by-type').getAll('CLASS')
    return all.filter((term) => {
      return !term.meta?.deprecated
    })
  }
}
