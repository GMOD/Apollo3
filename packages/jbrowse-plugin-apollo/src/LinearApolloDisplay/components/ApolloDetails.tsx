import { AppRootModel, getSession } from '@jbrowse/core/util'
import CloseIcon from '@mui/icons-material/Close'
import { Autocomplete, Button, IconButton, TextField } from '@mui/material'
import {
  DataGrid,
  GridColDef,
  GridRenderEditCellParams,
  GridRowModel,
  MuiBaseEvent,
  useGridApiContext,
} from '@mui/x-data-grid'
import { AnnotationFeatureI } from 'apollo-mst'
import {
  LocationEndChange,
  LocationStartChange,
  TypeChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import { getRoot, getSnapshot } from 'mobx-state-tree'
import React, { useEffect, useMemo, useState } from 'react'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { createFetchErrorMessage } from '../../util'
import { LinearApolloDisplay } from '../stateModel'

function getFeatureColumns(
  editable: boolean,
  internetAccount: ApolloInternetAccountModel,
): GridColDef[] {
  return [
    { field: 'id', headerName: 'ID', width: 50 },
    {
      field: 'type',
      headerName: 'Type',
      width: 200,
      editable,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <AutocompleteInputCell {...params} internetAccount={internetAccount} />
      ),
    },
    { field: 'refSeq', headerName: 'Ref Name', width: 70 },
    { field: 'start', headerName: 'Start', type: 'number', editable },
    { field: 'end', headerName: 'End', type: 'number', editable },
    { field: 'attributes', headerName: 'Attributes', width: 700 },
    {
      field: 'AttributeButton',
      headerName: 'Link to Attributes',
      width: 150,
      renderCell: (params) => (
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleButtonClick(params.row.id)}
        >
          Link to attributes
        </Button>
      ),
    },
  ]
}

const handleButtonClick = (idPressed: string) => {
  console.log(`Feature clicked: ${idPressed}`)
  // HOW TO OPEN MODIFY ATTRIBUTES FROM HERE
}

interface AutocompleteInputCellProps extends GridRenderEditCellParams {
  internetAccount: ApolloInternetAccountModel
}

function AutocompleteInputCell(props: AutocompleteInputCellProps) {
  const { id, value, field, row, internetAccount } = props
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>([])
  const apiRef = useGridApiContext()

  useEffect(() => {
    async function getSOSequenceTerms() {
      const { feature } = row as { feature: AnnotationFeatureI }
      const { type, parent, children } = feature
      let endpoint = `/ontologies/descendants/sequence_feature`
      if (parent) {
        endpoint = `/ontologies/descendants/${parent.type}`
      } else if (children?.size) {
        endpoint = `/ontologies/equivalents/${type}`
      }
      const { baseURL, getFetcher } = internetAccount
      const uri = new URL(endpoint, baseURL).href
      const apolloFetch = getFetcher({ locationType: 'UriLocation', uri })
      const response = await apolloFetch(uri, { method: 'GET' })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when retrieving ontologies from server',
        )
        throw new Error(newErrorMessage)
      }
      const soTerms = (await response.json()) as string[] | undefined
      if (soTerms) {
        setSOSequenceTerms(soTerms)
      }
    }
    getSOSequenceTerms()
  }, [internetAccount, row])

  const handleChange = async (
    event: MuiBaseEvent,
    newValue?: string | null,
  ) => {
    const isValid = await apiRef.current.setEditCellValue({
      id,
      field,
      value: newValue,
    })
    if (isValid) {
      apiRef.current.stopCellEditMode({ id, field })
    }
  }

  if (!soSequenceTerms.length) {
    return null
  }

  return (
    <Autocomplete
      options={soSequenceTerms}
      style={{ width: 245 }}
      renderInput={(params) => <TextField {...params} variant="outlined" />}
      value={String(value)}
      onChange={handleChange}
      disableClearable
      selectOnFocus
      handleHomeEndKeys
    />
  )
}

export const ApolloDetails = observer(
  ({ model }: { model: LinearApolloDisplay }) => {
    const session = getSession(model)
    // const session = getSession(model)
    const { internetAccounts } = getRoot(session) as AppRootModel
    const internetAccount = useMemo(() => {
      const apolloInternetAccount = internetAccounts.find(
        (ia) => ia.type === 'ApolloInternetAccount',
      ) as ApolloInternetAccountModel | undefined
      if (!apolloInternetAccount) {
        throw new Error('No Apollo internet account found')
      }
      return apolloInternetAccount
    }, [internetAccounts])
    const editable =
      Boolean(internetAccount.authType) &&
      ['admin', 'user'].includes(internetAccount.getRole() || '')
    const {
      selectedFeature,
      setSelectedFeature,
      changeManager,
      detailsHeight,
    } = model
    if (!selectedFeature) {
      return <div>click on a feature to see details</div>
    }
    const {
      _id: id,
      type,
      refSeq,
      start,
      end,
      assemblyId: assembly,
    } = selectedFeature
    let refName = refSeq
    const { assemblyManager } = session

    if (assemblyManager.get(assembly)?.refNameAliases) {
      const refNames = assemblyManager.get(assembly)!.refNameAliases!
      Object.keys(refNames).forEach((key) => {
        if (key === refSeq) {
          refName = refNames[key]
        }
      })
    }

    let tmp = Object.fromEntries(
      Array.from(selectedFeature.attributes.entries()).map(([key, value]) => {
        if (key.startsWith('gff_')) {
          const newKey = key.substring(4)
          const capitalizedKey =
            newKey.charAt(0).toUpperCase() + newKey.slice(1)
          return [capitalizedKey, getSnapshot(value)]
        }
        if (key === '_id') {
          return ['ID', getSnapshot(value)]
        }
        return [key, getSnapshot(value)]
      }),
    )
    let attributes = Object.entries(tmp)
      .map(([key, values]) => `${key}=${values.join(', ')}`)
      .join(', ')

    const selectedFeatureRows = [
      {
        id,
        type,
        refSeq: refName,
        start,
        end,
        feature: selectedFeature,
        model,
        attributes,
      },
    ]
    function addChildFeatures(f: typeof selectedFeature) {
      f?.children?.forEach((child: AnnotationFeatureI, childId: string) => {
        tmp = Object.fromEntries(
          Array.from(child.attributes.entries()).map(([key, value]) => {
            if (key.startsWith('gff_')) {
              const newKey = key.substring(4)
              const capitalizedKey =
                newKey.charAt(0).toUpperCase() + newKey.slice(1)
              return [capitalizedKey, getSnapshot(value)]
            }
            if (key === '_id') {
              return ['ID', getSnapshot(value)]
            }
            return [key, getSnapshot(value)]
          }),
        )
        attributes = Object.entries(tmp)
          .map(([key, values]) => `${key}=${values.join(', ')}`)
          .toString()

        selectedFeatureRows.push({
          id: child._id,
          type: child.type,
          refSeq: refName,
          start: child.start,
          end: child.end,
          feature: child,
          model,
          attributes,
        })
        addChildFeatures(child)
      })
    }
    addChildFeatures(selectedFeature)
    function processRowUpdate(
      newRow: GridRowModel<typeof selectedFeatureRows[0]>,
      oldRow: GridRowModel<typeof selectedFeatureRows[0]>,
    ) {
      let change:
        | LocationStartChange
        | LocationEndChange
        | TypeChange
        | undefined = undefined
      if (newRow.start !== oldRow.start) {
        const { start: oldStart, id: featureId } = oldRow
        const { start: newStart } = newRow
        change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          featureId,
          oldStart,
          newStart: Number(newStart),
          assembly,
        })
      } else if (newRow.end !== oldRow.end) {
        const { end: oldEnd, id: featureId } = oldRow
        const { end: newEnd } = newRow
        change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          featureId,
          oldEnd,
          newEnd: Number(newEnd),
          assembly,
        })
      } else if (newRow.type !== oldRow.type) {
        const { type: oldType, id: featureId } = oldRow
        const { type: newType } = newRow
        change = new TypeChange({
          typeName: 'TypeChange',
          changedIds: [featureId],
          featureId,
          oldType: String(oldType),
          newType: String(newType),
          assembly,
        })
      }
      if (change) {
        changeManager?.submit(change)
      }
      return newRow
    }
    return (
      <div style={{ width: '100%', position: 'relative' }}>
        <IconButton
          aria-label="close"
          style={{ position: 'absolute', right: 0, zIndex: 1 }}
          onClick={() => {
            setSelectedFeature(undefined)
          }}
        >
          <CloseIcon />
        </IconButton>
        <DataGrid
          style={{ height: detailsHeight }}
          rows={selectedFeatureRows}
          columns={getFeatureColumns(editable, internetAccount)}
          columnVisibilityModel={{
            id: false,
          }}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={console.error}
        />
      </div>
    )
  },
)
