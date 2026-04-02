import { type IDBPDatabase, openDB } from 'idb/with-async-ittr'

export type FeatureDatabase = IDBPDatabase

export async function openDb(
  assemblyName: string,
  refNames: string[],
): Promise<FeatureDatabase> {
  const dbName = `Apollo-${assemblyName}`
  return openDB(dbName, 1, {
    upgrade(db) {
      const changesStoreName = 'changes'
      if (!db.objectStoreNames.contains(changesStoreName)) {
        db.createObjectStore(changesStoreName, { autoIncrement: true })
      }
      for (const refName of refNames) {
        const storeName = `features-${refName}`
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName)
          store.createIndex('min', 'min', { unique: false })
          store.createIndex('max', 'max', { unique: false })
        }
        const checkStoreName = `checkresults-${refName}`
        if (!db.objectStoreNames.contains(checkStoreName)) {
          const store = db.createObjectStore(checkStoreName, {
            keyPath: '_id',
          })
          store.createIndex('min', 'start', { unique: false })
          store.createIndex('max', 'end', { unique: false })
          store.createIndex('featureId', 'featureId', {
            unique: false,
          })
        }
      }
    },
  })
}
