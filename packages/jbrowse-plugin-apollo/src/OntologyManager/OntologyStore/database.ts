import { openLocation } from '@jbrowse/core/util/io'
import { IDBPDatabase, IDBPTransaction, openDB } from 'idb'

import { OntologyDB } from './database-schema'
import GraphDocument from './obo-graph-json-schema'
import OntologyStore from '.'

/** schema version we are currently on, used for the IndexedDB schema open call */
const schemaVersion = 1

export type Database = IDBPDatabase<OntologyDB>

/** open the IndexedDB and create the DB schema if necessary */
export async function openDatabase(dbName: string) {
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
        database.createObjectStore('meta', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('nodes')) {
        database.createObjectStore('nodes', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('edges')) {
        database.createObjectStore('edges', { autoIncrement: true })
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

  debugger

  const tx = db.transaction(['meta', 'nodes', 'edges'], 'readwrite')

  // NOTE: all these .add promises are ignored because the transaction is
  // monitoring them and the tx.done promise will reject if they fail

  // load nodes
  const nodeStore = tx.objectStore('nodes')
  for (const node of graph.nodes || []) {
    await nodeStore.add(node)
  }
  // load edges
  const edgeStore = tx.objectStore('edges')
  for (const edge of graph.edges || []) {
    await edgeStore.add(edge)
  }

  // load graph meta data
  if (graph.meta) {
    const metaStore = tx.objectStore('meta')
    // graph metadata
    await metaStore.add({
      id: graph.id || 'graph',
      objectType: 'graph',
      data: graph.meta,
    })
  }

  await tx.done

  // record some metadata about this load operation
  const tx2 = db.transaction('meta', 'readwrite')
  void tx2.objectStore('meta').add({
    id: 'load',
    objectType: 'database',
    data: {
      timestamp: String(new Date()),
      schemaVersion,
      timings: {
        fetchAndParse: parseTime - startTime,
        loading: Date.now() - parseTime,
      },
    },
  })

  await tx2.done
  return
}

export async function isDatabaseCompletelyLoaded(db: Database) {
  // since metadata is loaded last, we use it as a signal that all the other data
  // was loaded
  const tx = db.transaction('meta')
  const count = await tx.objectStore('meta').count()
  return count !== 0
}
