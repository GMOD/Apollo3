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

export const addSingleRecord = <T>(
  storeName: string,
  data: T,
): Promise<T | string | null> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName, version)

    request.onsuccess = async () => {
      console.log(`Add single record: ${JSON.stringify(data)}`)
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

// export function addBatchData(storeName: string, data: GOTerm[]) {
//   request = indexedDB.open(dbName, version)
//   const start = Date.now()
//   console.log('Adding batch data...')
//   request.onsuccess = async () => {
//     db = request.result
//     let id = Date.now()
//     data.forEach((item) => {
//       const tx = db.transaction(storeName, 'readwrite')
//       const store = tx.objectStore(storeName)
//       store.add({ id, goId: item.id, description: item.label })
//       id++
//     })
//   }
//   request.onerror = () => {
//     const error = request.error?.message
//     if (error) {
//       console.log(`ERROR: ${error}`)
//     }
//   }
//   const end = Date.now()
//   console.log(`Execution time: ${end - start} ms`)
// }

export const addBatchData = <T>(
  storeName: string,
  data: GOTerm[],
): Promise<number> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName, version)
    const start = Date.now()
    console.log('Adding batch data...')
    request.onsuccess = () => {
      db = request.result
      let id = Date.now()
      data.forEach((item) => {
        const tx = db.transaction(storeName, 'readwrite')
        const store = tx.objectStore(storeName)
        store.add({ id, goId: item.id, description: item.label })
        id++
      })
      const end = Date.now()
      console.log(`Execution time: ${end - start} ms`)
      resolve(100)
    }
    request.onerror = () => {
      const error = request.error?.message
      if (error) {
        console.log(`ERROR: ${error}`)
      }
    }
  })
}
export const getStoreData = <T>(storeName: Stores): Promise<T[]> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName)

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

export const getStoreDataCount = <T>(): Promise<number> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName)
    request.onsuccess = () => {
      console.log('Get data count')
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
): Promise<GOTerm[]> => {
  return new Promise((resolve) => {
    request = indexedDB.open(goDbName)

    request.onsuccess = () => {
      console.log('getDataByID')
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
          cursor.continue()
        } else {
          resolve(matchingRecords)
        }
      }
    }
  })
}

// export async function getDataByID2(storeName: Stores, searchStr: string) {
//   request = indexedDB.open(dbName)

//   request.onsuccess = () => {
//     console.log('getDataByID')
//     db = request.result
//     const tx = db.transaction(storeName, 'readonly')
//     const store = tx.objectStore(storeName)
//     const matchingRecords: any[] = []
//     store.openCursor().onsuccess = (event: Event) => {
//       const cursor = (event.target as unknown as IDBRequest).result

//       if (cursor) {
//         const record = cursor.value
//         const idVal: string = record.goId
//         if ((record.goId as string).includes(searchStr)) {
//           console.log(`LOYTYI : ${JSON.stringify(record.goId)}`)
//           matchingRecords.push(record)
//         }
//         cursor.continue()
//       }
//     }
//     return matchingRecords
//   }
//   // })
// }
