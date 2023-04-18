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
export const goDbName = 'goDB'

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // open the connection
    request = indexedDB.open(goDbName)

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
      console.log('Database is now initialized')
      resolve(true)
    }

    request.onerror = () => {
      resolve(false)
    }
  })
}

export const addBatchData = <T>(
  storeName: string,
  data: GOTerm[],
): Promise<number> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName, version)
    console.log('Adding GO terms...')
    request.onsuccess = () => {
      db = request.result
      let id = Date.now()
      let cnt = 0
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      data.forEach((item) => {
        store.add({ id, goId: item.id, description: item.label })
        id++
        cnt++
      })
      resolve(cnt)
    }
    request.onerror = () => {
      const error = request.error?.message
      if (error) {
        console.log(`ERROR: ${error}`)
      }
    }
  })
}

export const getStoreDataCount = <T>(): Promise<number> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName)
    request.onsuccess = () => {
      db = request.result
      const objectStore = db
        .transaction(Stores.GOTerms, 'readonly')
        .objectStore(Stores.GOTerms)
      const countRequest = objectStore.count()
      countRequest.onsuccess = (event) => {
        const count = countRequest.result
        console.log(`There are ${count} records in the database.`)
        resolve(count)
      }
      countRequest.onerror = (event) => {
        console.error('Error counting records:', countRequest.error)
      }
    }
  })
}

export const getDataByID = <T>(
  storeName: Stores,
  searchStr: string,
  limit = 40,
): Promise<GOTerm[]> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName)

    request.onsuccess = () => {
      db = request.result
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const matchingRecords: GOTerm[] = []

      store.openCursor().onsuccess = async (event: Event) => {
        const cursor = await (event.target as unknown as IDBRequest).result
        if (cursor) {
          const record = cursor.value
          const idVal: string = record.goId
          let descVal: string = record.description
          if (!descVal) {
            descVal = ''
          }
          if (idVal.includes(searchStr) || descVal.includes(searchStr)) {
            const newObject: GOTerm = { id: idVal, label: descVal }
            const alreadyAdded =
              matchingRecords.find((a) => a.id === newObject.id) !== undefined
            if (!alreadyAdded) {
              matchingRecords.push(newObject)
            }
          }
          if (matchingRecords.length >= limit) {
            resolve(matchingRecords)
          } else {
            cursor.continue()
          }
        } else {
          resolve(matchingRecords)
        }
      }
    }
  })
}
