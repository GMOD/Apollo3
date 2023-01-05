import { AbstractSessionModel, AppRootModel } from '@jbrowse/core/util'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Select,
  SelectChangeEvent,
  TextField,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { ChangeManager, FeatureAttributeChange } from 'apollo-shared'
import ObjectID from 'bson-objectid'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface ModifyFeatureAttributeProps {
  session: AbstractSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
}

interface Collection {
  _id: string
  name: string
}

export function ModifyFeatureAttribute({
  session,
  handleClose,
  sourceFeature,
  sourceAssemblyId,
  changeManager,
}: ModifyFeatureAttributeProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const [end, setEnd] = useState(String(sourceFeature.end))
  const [start, setStart] = useState(String(sourceFeature.start))
  const [type, setType] = useState('')
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [errorMessage, setErrorMessage] = useState('')
  const [collection, setCollection] = useState<Collection[]>([])
  const [assemblyId, setAssemblyId] = useState('')

  useEffect(() => {
    async function getAssemblies() {  // KIRJOITA TASTA FUNKTIO JOKA PALAUTTAA YHDEN FEATUREN ATTRIBUUTIT JA LATAA NE DROP-DOWN LISTAAN
      const uri = new URL('/assemblies', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          method: 'GET',
        })
        if (!response.ok) {
          let msg
          try {
            msg = await response.text()
          } catch (e) {
            msg = ''
          }
          setErrorMessage(
            `Error when copying features — ${response.status} (${
              response.statusText
            })${msg ? ` (${msg})` : ''}`,
          )
          return
        }
        const data = await response.json()
        data.forEach((item: Collection) => {
          // Do not show source assembly in the list of target assemblies
          if (item._id !== sourceAssemblyId) {
            setCollection((result) => [
              ...result,
              {
                _id: item._id,
                name: item.name,
              },
            ])
          }
        })
      }
    }
    getAssemblies()
    return () => {
      setCollection([{ _id: '', name: '' }])
    }
  }, [apolloInternetAccount, baseURL, sourceAssemblyId, sourceFeature])

  function handleChangeAssembly(e: SelectChangeEvent<string>) {
    setAssemblyId(e.target.value as string)
  }
  
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const dummy: Record<string, string[]> = {a: ["hey"], b: ["you"]}
    const change = new FeatureAttributeChange({
      changedIds: [sourceFeature._id],
      typeName: 'FeatureAttributeChange',
      assembly: sourceAssemblyId,
      featureId: sourceFeature._id,
      attributes: dummy,
    })
    changeManager.submit?.(change)
    notify(`Feature attributes added/edited/deleted successfully`, 'success')
    handleClose()
    event.preventDefault()
  }

  const error = Number(end) <= Number(start)
  return (
    <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>Feature attributes</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
        <DialogContentText>Target assembly</DialogContentText>
          <Select
            labelId="label"
            value={assemblyId}
            onChange={handleChangeAssembly}
          >
            {collection.map((option) => (
              <MenuItem key={option._id} value={option._id}>
                {option.name}
              </MenuItem>
            ))}
          </Select>
          <TextField
            autoFocus
            margin="dense"
            id="start"
            label="Start"
            type="number"
            fullWidth
            variant="outlined"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            margin="dense"
            id="end"
            label="End"
            type="number"
            fullWidth
            variant="outlined"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            error={error}
            helperText={error ? '"End" must be greater than "Start"' : null}
          />
          <TextField
            margin="dense"
            id="type"
            label="Type"
            type="text"
            fullWidth
            variant="outlined"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
        </DialogContent>

        <DialogActions>
          <Button
            variant="contained"
            type="submit"
            disabled={error || !(start && end && type)}
          >
            Submit
          </Button>
          <Button
            variant="outlined"
            type="submit"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </form>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
