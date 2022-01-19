import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { Button, MenuItem, TextField } from '@material-ui/core'
import { observer } from 'mobx-react'
import { IAnyStateTreeNode, getRoot } from 'mobx-state-tree'
import React, { useState } from 'react'

const checkAllUsers = async (token: string) => {
  const userResponse = await fetch(`http://localhost:8084/api/user`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!userResponse.ok) {
    return []
  }
  return userResponse.json()
}

const checkSpecificUser = async (token: string, id: string) => {
  const userResponse = await fetch(`http://localhost:8084/api/user/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!userResponse.ok) {
    return ''
  }
  return userResponse.json()
}

function ApolloAuth({ model }: { model: IAnyStateTreeNode }) {
  const [token, setToken] = useState(
    sessionStorage.getItem('apolloInternetAccount-token') || '',
  )
  const [userList, setUserList] = useState<{ [key: string]: string }[]>([])
  const [currentId, setCurrentId] = useState('')
  const [user, setUser] = useState('')
  const rootModel = getRoot(model)
  return (
    <>
      <BaseCard title="Login">
        <div>
          <Button
            variant="contained"
            style={{ margin: 10 }}
            onClick={async () => {
              const newToken =
                await rootModel.internetAccounts[0].openLocation()
              setToken(newToken)
            }}
            disabled={!!sessionStorage.getItem('apolloInternetAccount-token')}
          >
            Login
          </Button>
        </div>
        {token && (
          <div>
            <Button
              variant="contained"
              onClick={async () => {
                const users = await checkAllUsers(token)
                setUserList(users)
              }}
            >
              Check All Users
            </Button>
            {userList.map((u) => (
              <MenuItem value={u.id}>
                {u.firstName} {u.lastName}
              </MenuItem>
            ))}

            <TextField
              label="Enter User ID"
              onChange={(event) => {
                setCurrentId(event.target.value)
              }}
            />
            <Button
              variant="contained"
              disabled={!currentId}
              onClick={async () => {
                const newUser = await checkSpecificUser(token, currentId)
                setUser(newUser)
              }}
            >
              Search Specific User
            </Button>
            {user && <p>User found: {user}</p>}
          </div>
        )}
      </BaseCard>
    </>
  )
}

export default observer(ApolloAuth)
