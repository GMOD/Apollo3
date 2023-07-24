import { openLocation } from '@jbrowse/core/util/io'
import { IDBPDatabase, IDBPTransaction, deleteDB, openDB } from 'idb'

import {
  OntologyDB,
  isOntologyDBEdge,
  isOntologyDBNode,
} from './indexeddb-schema'
import GraphDocument from './obo-graph-json-schema'
import OntologyStore from '.'

/** schema version we are currently on, used for the IndexedDB schema open call */
const schemaVersion = 1

export type Database = IDBPDatabase<OntologyDB>

/** open the IndexedDB and create the DB schema if necessary */
export async function openDatabase(dbName: string) {
  await deleteDB(dbName) // TODO: delete this
  return openDB<OntologyDB>(dbName, schemaVersion, {
    upgrade(
      database: IDBPDatabase<OntologyDB>,
      oldVersion: number,
      newVersion: number | null,
      transaction: IDBPTransaction<
        OntologyDB,
        ArrayLike<'nodes' | 'edges'>,
        'versionchange'
      >,
      event: IDBVersionChangeEvent,
    ): void {
      if (schemaVersion !== 1) {
        throw new Error(
          'now that the schemaVersion is past 1, you need to write some upgrade logic here',
        )
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

/** load a OBO Graph JSON file into a database */
export async function loadOboGraphJson(store: OntologyStore, db: Database) {
  const startTime = Date.now()

  // TODO: using file streaming along with an event-based json parser
  // instead of JSON.parse and .readFile could probably make this faster
  // and less memory intensive
  const oboGraph = JSON.parse(
    await openLocation(store.sourceLocation).readFile('utf8'),
  ) as GraphDocument

  const parseTime = Date.now()

  const [graph, ...additionalGraphs] = oboGraph.graphs || []
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
    for (const node of graph.nodes || []) {
      if (isOntologyDBNode(node)) {
        await nodeStore.add(node)
      }
    }

    // load edges
    const edgeStore = tx.objectStore('edges')
    for (const edge of graph.edges || []) {
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
          name: store.ontologyName,
          version: store.ontologyVersion,
          sourceLocation: store.sourceLocation,
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

export async function isDatabaseCompletelyLoaded(db: Database) {
  // since metadata is loaded last, we use it as a signal that all the other data
  // was loaded
  const [meta] = await db.transaction('meta').objectStore('meta').getAll()
  return !!meta
}
