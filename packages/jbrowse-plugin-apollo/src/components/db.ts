import { element } from 'prop-types'

import { GOTerm } from './ModifyFeatureAttribute'

let request: IDBOpenDBRequest
let db: IDBDatabase
let version = 1

export interface User {
  id: string
  name: string
  email: string
}

export interface GOTermDb {
  id: string
  goId: string
  description: string
}

export enum Stores {
  Users = 'users',
  GOTerms = 'goTerms',
}

export const initDB = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // open the connection
    request = indexedDB.open('myDB')

    request.onupgradeneeded = () => {
      db = request.result

      // if the data object store doesn't exist, create it
      if (!db.objectStoreNames.contains(Stores.Users)) {
        console.log('Creating users store')
        db.createObjectStore(Stores.Users, { keyPath: 'id' })
      }
      // if the data object store doesn't exist, create it
      if (!db.objectStoreNames.contains(Stores.GOTerms)) {
        console.log('Creating GOTerms store')
        db.createObjectStore(Stores.GOTerms, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => {
      db = request.result
      version = db.version
      console.log('request.onsuccess - initDB', version)
      resolve(true)
    }

    request.onerror = () => {
      resolve(false)
    }
  })
}

export const addData = <T>(
  storeName: string,
  data: T,
): Promise<T | string | null> => {
  return new Promise((resolve) => {
    request = indexedDB.open('myDB', version)

    request.onsuccess = async () => {
      console.log('request.onsuccess - addData', data)
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

export function addDataV2(storeName: string, data: GOTerm[]) {
    console.log('1 are we here')
    request = indexedDB.open('myDB', version)
      const start = Date.now()
      request.onsuccess = async () => {
    console.log('2 are we here')
    db = request.result
    let id = Date.now()
    data.forEach((item) => {
    //   console.log('request.onsuccess - addData', id, JSON.stringify(item))
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      store.add({ id, goId: item.id, description: item.label })
      id++
    })
  }
  request.onerror = () => {
    const error = request.error?.message
    if (error) {
      console.log(error)
      //   resolve(error)
      // } else {
      //   resolve('Unknown error')
    }
  }
      const end = Date.now()
      console.log(`Execution time: ${end - start} ms`)

}

export function addDataV3(
  storeName: string,
  data: GOTerm,
  dbParam: IDBDatabase,
) {
  console.log('request.onsuccess - addData', data)
  const tx = dbParam.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  store.add(data)
}

export const getStoreData = <T>(storeName: Stores): Promise<T[]> => {
  console.log('haetaan dataa...')
  return new Promise((resolve) => {
    request = indexedDB.open('myDB')

    request.onsuccess = () => {
      console.log('request.onsuccess - getAllData')
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
