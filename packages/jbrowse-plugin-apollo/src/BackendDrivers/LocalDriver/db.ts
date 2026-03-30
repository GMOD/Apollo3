import { type IDBPDatabase, openDB } from 'idb/with-async-ittr'

export type FeatureDatabase = IDBPDatabase

export async function openDb(
  assemblyName: string,
  refNames: string[],
): Promise<FeatureDatabase> {
  const dbName = `Apollo-${assemblyName}`
  return openDB(dbName, 1, {
    upgrade(db) {
      for (const refName of refNames) {
        const storeName = `features-${refName}`
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName)
          store.createIndex('min', 'min', { unique: false })
          store.createIndex('max', 'max', { unique: false })
        }
      }
    },
  })
}
