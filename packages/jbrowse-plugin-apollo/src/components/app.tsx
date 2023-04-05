import { Button, Checkbox, DialogActions, TextField } from '@mui/material'
import React from 'react'
import { useState } from 'react'

import { Stores, User, addData, getStoreData, initDB } from './db'

export default function Home() {
  const [isDBReady, setIsDBReady] = useState<boolean>(false)

  const handleInitDB = async () => {
    const status = await initDB()
    setIsDBReady(status)
  }

  const handleAddUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    const target = e.target as typeof e.target & {
      goId: { value: string }
      description: { value: string }
    }

    const goId = 'eka' //target.name.value
    const description = 'toka' //target.email.value
    // we must pass an Id since it's our primary key declared in our createObjectStoreMethod  { keyPath: 'id' }
    const id = Date.now()

    // if (name.trim() === '' || email.trim() === '') {
    //   alert('Please enter a valid name and email')
    //   return
    // }

    try {
      const res = await addData(Stores.Users, { goId, description, id })
    } catch (err: unknown) {
      if (err instanceof Error) {
        //   setError(err.message)
        console.log(`ERROR: ${err.message}`)
      } else {
        console.log(`ERROR: Something went wrong`)
        // setError('Something went wrong')
      }
    }
    // const usersTmp = await getStoreData<User>(Stores.Users)
    // setUsers(usersTmp)
    // console.log(`DATA: ${usersTmp}`)
  }
  const [users, setUsers] = useState<User[] | []>([])

  // declare this async method
  const handleGetUsers = async () => {
    const usersTmp = await getStoreData<User>(Stores.Users)
    setUsers(usersTmp)
  }
  const [goAttribute, setGoAttribute] = useState(false)

  return (
    <main style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h1>IndexedDB</h1>
      {!isDBReady ? (
        <button onClick={handleInitDB}>Init DB</button>
      ) : (
        <h2>DB is ready</h2>
      )}
      {/* add user form */}
      <form onSubmit={handleAddUser}>
        <input type="text" name="name" placeholder="Name" />
        <input type="email" name="email" placeholder="Email" />
        <button type="submit">Add User</button>
      </form>
      <DialogActions>
        <Button
          key="addButton"
          color="primary"
          variant="contained"
          style={{ margin: 2 }}
          // eslint-disable-next-line prettier/prettier, @typescript-eslint/no-unused-expressions
                onClick={() => {handleGetUsers}
          }
        >
          Hae
        </Button>
      </DialogActions>
      {/* {error && <p style={{ color: 'red' }}>{error}</p>} */}
      {users.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
