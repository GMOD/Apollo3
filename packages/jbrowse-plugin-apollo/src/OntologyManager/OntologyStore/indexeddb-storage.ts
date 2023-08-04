import { openLocation } from '@jbrowse/core/util/io'
import { IDBPDatabase, IDBPTransaction, openDB } from 'idb/with-async-ittr'

import { PREFIXED_ID_PATH, getWords } from './fulltext'
import {
  OntologyDB,
  isOntologyDBEdge,
  isOntologyDBNode,
} from './indexeddb-schema'
import { GraphDocument } from './obo-graph-json-schema'
import OntologyStore from '.'

/** schema version we are currently on, used for the IndexedDB schema open call */
const schemaVersion = 2

export type Database = IDBPDatabase<OntologyDB>

/** open the IndexedDB and create the DB schema if necessary */
export async function openDatabase(this: OntologyStore, dbName: string) {
  // await deleteDB(dbName) // uncomment this to reload every time during development
  return openDB<OntologyDB>(dbName, schemaVersion, {
    upgrade(
      database: IDBPDatabase<OntologyDB>,
      oldVersion: number,
      newVersion: number | null,
      transaction: IDBPTransaction<
        OntologyDB,
        ArrayLike<'nodes' | 'edges' | 'meta'>,
        'versionchange'
      >,
      _event: IDBVersionChangeEvent,
    ): void {
      if (oldVersion < schemaVersion) {
        if (database.objectStoreNames.contains('meta')) {
          database.deleteObjectStore('meta')
        }
        if (database.objectStoreNames.contains('nodes')) {
          database.deleteObjectStore('nodes')
        }
        if (database.objectStoreNames.contains('edges')) {
          database.deleteObjectStore('edges')
        }
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta')
      }
      if (!database.objectStoreNames.contains('nodes')) {
        database.createObjectStore('nodes', { keyPath: 'id' })
        const nodes = transaction.objectStore('nodes')
        nodes.createIndex('by-label', 'lbl')
        nodes.createIndex('by-type', 'type')
        nodes.createIndex('by-synonym', ['meta', 'synonyms', 'val'])
        nodes.createIndex('full-text-words', 'fullTextWords', {
          multiEntry: true,
        })
      }
      if (!database.objectStoreNames.contains('edges')) {
        database.createObjectStore('edges', { autoIncrement: true })
        const edges = transaction.objectStore('edges')
        edges.createIndex('by-subject', 'sub')
        edges.createIndex('by-object', 'obj')
        edges.createIndex('by-predicate', 'pred')
      }
    },
  })
}

/** serialize all our words in the DB node so they can be indexed */
function serializeWords(foundWords: Iterable<[string, string]>): string[] {
  const allWords = new Set<string>()
  for (const [, word] of foundWords) {
    allWords.add(word)
  }
  return Array.from(allWords)
}

/** load a OBO Graph JSON file into a database */
export async function loadOboGraphJson(this: OntologyStore, db: Database) {
  const startTime = Date.now()

  // TODO: using file streaming along with an event-based json parser
  // instead of JSON.parse and .readFile could probably make this faster
  // and less memory intensive
  const oboGraph = JSON.parse(
    await openLocation(this.sourceLocation).readFile('utf8'),
  ) as GraphDocument

  const parseTime = Date.now()

  const [graph, ...additionalGraphs] = oboGraph.graphs ?? []
  if (!graph) {
    return
  }
  if (additionalGraphs.length) {
    throw new Error('multiple graphs not supported')
  }

  try {
    const tx = db.transaction(['meta', 'nodes', 'edges'], 'readwrite')
    await tx.objectStore('meta').clear()
    await tx.objectStore('nodes').clear()
    await tx.objectStore('edges').clear()

    // load nodes
    const nodeStore = tx.objectStore('nodes')
    const fullTextIndexPaths = getTextIndexPaths.call(this)
    for (const node of graph.nodes ?? []) {
      if (isOntologyDBNode(node)) {
        await nodeStore.add({
          ...node,
          fullTextWords: serializeWords(
            getWords(node, fullTextIndexPaths, this.prefixes),
          ),
        })
      }
    }

    // load edges
    const edgeStore = tx.objectStore('edges')
    for (const edge of graph.edges ?? []) {
      if (isOntologyDBEdge(edge)) {
        await edgeStore.add(edge)
      }
    }

    await tx.done

    // record some metadata about this ontology and load operation
    const tx2 = db.transaction('meta', 'readwrite')
    await tx2.objectStore('meta').add(
      {
        ontologyRecord: {
          name: this.ontologyName,
          version: this.ontologyVersion,
          sourceLocation: this.sourceLocation,
        },
        graphMeta: graph.meta,
        timestamp: String(new Date()),
        schemaVersion,
        timings: {
          overall: Date.now() - startTime,
          load: Date.now() - parseTime,
        },
      },
      'meta',
    )

    await tx2.done
  } catch (e) {
    await db.transaction('meta', 'readwrite').objectStore('meta').clear()
    throw e
  }
  return
}

export function getTextIndexPaths(this: OntologyStore) {
  return [
    PREFIXED_ID_PATH,
    ...(this.options.textIndexing?.indexPaths ?? [
      '$.lbl',
      '$.meta.synonyms[*].val',
      '$.meta.definition.val',
    ]),
  ]
}

export async function isDatabaseCompletelyLoaded(db: Database) {
  // since metadata is loaded last, we use it as a signal that all the other data
  // was loaded
  const [meta] = await db.transaction('meta').objectStore('meta').getAll()
  return !!meta
}
