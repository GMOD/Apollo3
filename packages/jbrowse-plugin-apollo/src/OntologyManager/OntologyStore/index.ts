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

type SourceLocation = UriLocation | LocalPathLocation | BlobLocation

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
    return `Apollo Ontology "${this.ontologyName}" version "${this.ontologyVersion}"`
  }

  async prepareDatabase() {
    // check for our database being completely loaded
    const db = await openDatabase(this.dbName)

    // if database is already completely loaded, just return it
    if (await isDatabaseCompletelyLoaded(db)) {
      return db
    }

    const { sourceType } = this
    if (!sourceType) {
      throw new Error(
        `unable to determine format of ontology source file ${JSON.stringify(
          this.sourceLocation,
        )}`,
      )
    }
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
}
