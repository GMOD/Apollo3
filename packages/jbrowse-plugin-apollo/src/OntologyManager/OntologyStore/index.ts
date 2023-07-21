import {
  BlobLocation,
  LocalPathLocation,
  UriLocation,
  isUriLocation,
} from '@jbrowse/core/util'

import {
  isDatabaseCompletelyLoaded,
  loadOboGraphJson,
  openDatabase,
} from './database'

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
  ontologyPrefix: string
  ontologyName: string
  ontologyVersion: string
  sourceLocation: SourceLocation
  db: ReturnType<OntologyStore['prepareDatabase']>

  constructor(
    name: string,
    prefix: string,
    version: string,
    source: SourceLocation,
  ) {
    this.ontologyPrefix = prefix
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
    return `Apollo Ontology - ${this.ontologyName} ${this.ontologyVersion}`
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

  async nodeCount() {
    const tx = (await this.db).transaction('nodes')
    return tx.objectStore('nodes').count()
  }
}
