import { GOTerm } from './ModifyFeatureAttribute'

let request: IDBOpenDBRequest
let db: IDBDatabase
let version = 1

export interface GOTermDb {
  id: string
  goId: string
  description: string
}

export enum Stores {
  GOTerms = 'goTerms',
}

const dbName = 'goDB'
export const initDB = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // open the connection
    request = indexedDB.open(dbName)

    request.onupgradeneeded = () => {
      db = request.result
      // if the data object store doesn't exist, create it
      if (!db.objectStoreNames.contains(Stores.GOTerms)) {
        console.log('Creating GOTerms store')
        db.createObjectStore(Stores.GOTerms, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => {
      db = request.result
      version = db.version
      console.log('Database initialized', version)
      resolve(true)
    }

    request.onerror = () => {
      resolve(false)
    }
  })
}

export const addSingleRecord = <T>(
  storeName: string,
  data: T,
): Promise<T | string | null> => {
  return new Promise((resolve) => {
    request = indexedDB.open(dbName, version)

    request.onsuccess = async () => {
      console.log(`Add singele record: ${JSON.stringify(data)}`)
      db = await request.result
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.add(data)
      resolve(data)
    }

    request.onerror = () => {
      const error = request.error?.message
      if (error) {
        resolve(error)
      } else {
        resolve('Unknown error')
      }
    }
  })
}

export function addBatchData(storeName: string, data: GOTerm[]) {
  request = indexedDB.open(dbName, version)
  const start = Date.now()
  console.log('Adding batch data...')
  request.onsuccess = async () => {
    db = request.result
    let id = Date.now()
    data.forEach((item) => {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.add({ id, goId: item.id, description: item.label })
      id++
    })
  }
  request.onerror = () => {
    const error = request.error?.message
    if (error) {
      console.log(`ERROR: ${error}`)
    }
  }
  const end = Date.now()
  console.log(`Execution time: ${end - start} ms`)
}

// export function addDataV3(
//   storeName: string,
//   data: GOTerm,
//   dbParam: IDBDatabase,
// ) {
//   console.log('request.onsuccess - addData', data)
//   const tx = dbParam.transaction(storeName, 'readwrite')
//   const store = tx.objectStore(storeName)
//   store.add(data)
// }

export const getStoreData = <T>(storeName: Stores): Promise<T[]> => {
  return new Promise((resolve) => {
    request = indexedDB.open(dbName)

    request.onsuccess = () => {
      console.log('Get all data')
      db = request.result
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const res = store.getAll()
      res.onsuccess = () => {
        resolve(res.result)
      }
    }
  })
}
