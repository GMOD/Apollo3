/* eslint-disable @typescript-eslint/unbound-method */
import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { Dialog } from './Dialog'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  FormControl,
  Grid2,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'
import React, { useEffect, useRef, useState } from 'react'
import {
  CollaborationServerDriver,
  ApolloInternetAccount,
} from '../BackendDrivers'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { DataGrid, GridColDef, GridRowModel } from '@mui/x-data-grid'
import {
  AddRefSeqAliasesChange,
  SerializedRefSeqAliases,
} from '@apollo-annotation/shared'

const columns: GridColDef[] = [
  { field: 'refName', headerName: 'Ref Name' },
  { field: 'aliases', headerName: 'Aliases', editable: true },
]

interface AddChildFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  changeManager: ChangeManager
}

const isGeneratedObjectId = (key: string): boolean => {
  const pattern = /^[\da-f]{24}$/i
  return pattern.test(key)
}

export function AddRefSeqAliases({
  changeManager,
  handleClose,
  session,
}: AddChildFeatureProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [enableSubmit, setEnableSubmit] = useState(false)
  const [selectedAssembly, setSelectedAssembly] = useState<Assembly>()
  const [selectedRows, setSelectedRows] = useState<
    {
      id: number
      refName: string
      aliases: string
    }[]
  >([])
  const [refNameAliasMap, setRefNameAliasMap] = useState<Map<string, string[]>>(
    new Map(),
  )

  const { apolloDataStore } = session
  const { collaborationServerDriver } = apolloDataStore as {
    collaborationServerDriver: CollaborationServerDriver
    getInternetAccount(
      assemblyName?: string,
      internetAccountId?: string,
    ): ApolloInternetAccount
  }
  const assemblies = collaborationServerDriver.getAssemblies()

  useEffect(() => {
    let retry = 0
    const maxRetries = 2
    const initializeRefNameAliasMap = () => {
      if (!selectedAssembly) {
        return
      }
      const initialMap = new Map<string, string[]>()
      if (retry < maxRetries && !selectedAssembly.refNames) {
        retry++
        setTimeout(initializeRefNameAliasMap, 50)
      }
      if (!selectedAssembly.refNames) {
        return
      }
      const refNameAliasess = selectedAssembly.refNameAliases
      for (const key in refNameAliasess) {
        const value = refNameAliasess[key]
        if (!value || isGeneratedObjectId(key)) {
          continue
        }
        if (initialMap.has(value)) {
          const aliases = initialMap.get(value) ?? []
          initialMap.set(value, [...aliases, key])
        } else {
          initialMap.set(value, [key])
        }
      }
      setRefNameAliasMap(initialMap)
    }

    initializeRefNameAliasMap()
  }, [selectedAssembly])

  const handleChangeAssembly = (e: SelectChangeEvent) => {
    const newAssembly = assemblies.find((asm) => asm.name === e.target.value)
    setSelectedAssembly(newAssembly)
    setEnableSubmit(false)
    setErrorMessage('')
    if (fileRef.current) {
      fileRef.current.value = ''
    }
  }

  const handleChangeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) {
      return
    }
    // eslint-disable-next-line prefer-destructuring
    const file = e.target.files[0]
    const fileContent = await file.text()
    const lines = fileContent.split('\n')
    const newMap = new Map(refNameAliasMap)
    setErrorMessage('')
    for (const line of lines) {
      const aliases = line.split('\t')
      for (const alias of aliases) {
        if (newMap.has(alias)) {
          newMap.set(alias, [...(newMap.get(alias) ?? []), ...aliases])
        }
      }
    }
    setRefNameAliasMap(newMap)
  }

  const handleChangeFileHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChangeFile(e).catch(() => {
      setErrorMessage('Error reading file')
    })
  }

  const rowSelectionChange = (ids: number[]) => {
    if (ids.length > 0) {
      setEnableSubmit(true)
      const selectedRows = ids.flatMap((id) =>
        getTableRows().filter((row) => row.id === id),
      )
      setSelectedRows(selectedRows)
    } else {
      setEnableSubmit(false)
      setSelectedRows([])
    }
  }

  const getTableRows = () => {
    return [...refNameAliasMap].map((ele, i) => ({
      id: i,
      refName: ele[0],
      aliases: ele[1].filter((alias) => alias !== ele[0]).join(', '),
    }))
  }

  const processRowUpdate = (newRow: GridRowModel, _oldRow: GridRowModel) => {
    const newMap = new Map(refNameAliasMap)
    newMap.set(newRow.refName as string, (newRow.aliases as string).split(','))
    setRefNameAliasMap(newMap)
    return newRow
  }

  const handleSubmit = () => {
    const refSeqAliases: SerializedRefSeqAliases[] = []
    for (const row of selectedRows) {
      const { refName } = row
      const aliases: string[] = row.aliases
        .split(',')
        .map((alias) => alias.trim())
        .filter((alias) => alias.length > 0)
      refSeqAliases.push({
        refName,
        aliases,
      })
    }
    setErrorMessage('')
    if (!selectedAssembly) {
      setErrorMessage('No assembly selected')
      return
    }
    const change = new AddRefSeqAliasesChange({
      typeName: 'AddRefSeqAliasesChange',
      assembly: selectedAssembly.name,
      refSeqAliases,
    })
    changeManager.submit(change).catch(() => {
      setErrorMessage('Error submitting change')
    })
    handleClose()
  }

  return (
    <Dialog
      open
      title="Add reference sequence aliases"
      handleClose={handleClose}
      maxWidth={'sm'}
      data-testid="add-refseq-alias"
      fullWidth
    >
      <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
        <Grid2 container spacing={2}>
          <Grid2>
            <FormControl disabled={enableSubmit && !errorMessage} fullWidth>
              <InputLabel id="demo-simple-select-label">Assembly</InputLabel>
              <Select
                labelId="demo-simple-select-label"
                id="demo-simple-select"
                label="Assembly"
                value={selectedAssembly?.name ?? ''}
                onChange={handleChangeAssembly}
              >
                {assemblies.map((option) => (
                  <MenuItem key={option.name} value={option.name}>
                    {option.displayName ?? option.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid2>
          <Grid2>
            <InputLabel>Load RefName alias</InputLabel>
            <input
              type="file"
              onChange={handleChangeFileHandler}
              ref={fileRef}
              disabled={(enableSubmit && !errorMessage) || !selectedAssembly}
            />
          </Grid2>
        </Grid2>
        {selectedAssembly && refNameAliasMap.size > 0 ? (
          <div style={{ height: 200, width: '100%', marginTop: 20 }}>
            <InputLabel>
              Refname aliases found for selected assembly.
            </InputLabel>
            <DataGrid
              rows={getTableRows()}
              columns={columns}
              initialState={{
                pagination: {
                  paginationModel: { page: 0, pageSize: 5 },
                },
              }}
              pageSizeOptions={[5, 10]}
              onRowSelectionModelChange={(ids) => {
                rowSelectionChange(ids as number[])
              }}
              processRowUpdate={processRowUpdate}
              checkboxSelection
            ></DataGrid>
          </div>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          type="submit"
          disabled={!enableSubmit}
          onClick={handleSubmit}
        >
          Submit
        </Button>
        <Button variant="outlined" type="submit" onClick={handleClose}>
          Close
        </Button>
      </DialogActions>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
