import { AppRootModel, getSession } from '@jbrowse/core/util'
import { Autocomplete, TextField } from '@mui/material'
import {
  GridCellEditStartParams,
  GridColDef,
  GridRenderEditCellParams,
  GridRowModel,
  MuiBaseEvent,
  DataGrid as MuiDataGrid,
  useGridApiContext,
  useGridApiRef,
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

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'
import { ModifyFeatureAttribute } from '../components/ModifyFeatureAttribute'
import { LinearApolloDisplay } from '../LinearApolloDisplay/stateModel'
import { createFetchErrorMessage } from '../util'

interface GridRow {
  id: string
  type: string
  refSeq: string
  start: number
  end: number
  feature: AnnotationFeatureI
  model: LinearApolloDisplay
  attributes: unknown
}

function getFeatureColumns(
  editable: boolean,
  internetAccount: ApolloInternetAccountModel,
): GridColDef<GridRow>[] {
  return [
    {
      field: 'type',
      headerName: 'Type',
      width: 200,
      editable,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <AutocompleteInputCell {...params} internetAccount={internetAccount} />
      ),
    },
    { field: 'refSeq', headerName: 'Ref Name', width: 80 },
    {
      field: 'start',
      headerName: 'Start',
      type: 'number',
      width: 80,
      editable,
    },
    {
      field: 'end',
      headerName: 'End',
      type: 'number',
      width: 80,
      editable,
    },
    {
      field: 'attributes',
      headerName: 'Attributes',
      width: 300,
      editable,
    },
  ]
}

interface AutocompleteInputCellProps extends GridRenderEditCellParams {
  internetAccount: ApolloInternetAccountModel
}

function AutocompleteInputCell(props: AutocompleteInputCellProps) {
  const { id, value, field, row, internetAccount } = props
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const apiRef = useGridApiContext()

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function getSOSequenceTerms() {
      const { feature } = row
      const { type, parent, children } = feature
      let endpoint = `/ontologies/equivalents/sequence_feature`
      if (parent) {
        endpoint = `/ontologies/descendants/${parent.type}`
      } else if (children?.size) {
        endpoint = `/ontologies/equivalents/${type}`
      }
      const { baseURL, getFetcher } = internetAccount
      const uri = new URL(endpoint, baseURL).href
      const apolloFetch = getFetcher({ locationType: 'UriLocation', uri })
      const response = await apolloFetch(uri, { method: 'GET', signal })
      if (!response.ok) {
        const newErrorMessage = await createFetchErrorMessage(
          response,
          'Error when retrieving ontologies from server',
        )
        throw new Error(newErrorMessage)
      }
      const soTerms = (await response.json()) as string[] | undefined
      if (soTerms && !signal.aborted) {
        setSOSequenceTerms(soTerms)
      }
    }
    getSOSequenceTerms().catch((e) => {
      if (!signal.aborted) {
        setErrorMessage(String(e))
      }
    })
    return () => {
      controller.abort()
    }
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

  const extraTextFieldParams: { error?: boolean; helperText?: string } = {}
  if (errorMessage) {
    extraTextFieldParams.error = true
    extraTextFieldParams.helperText = errorMessage
  }

  return (
    <Autocomplete
      options={soSequenceTerms}
      style={{ width: 245 }}
      renderInput={(params) => {
        return (
          <TextField {...params} {...extraTextFieldParams} variant="outlined" />
        )
      }}
      value={String(value)}
      onChange={handleChange}
      disableClearable
      selectOnFocus
      handleHomeEndKeys
    />
  )
}

function DataGrid({ model }: { model: LinearApolloDisplay }) {
  const session = getSession(model)
  const apiRef = useGridApiRef()
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
    ['admin', 'user'].includes(internetAccount.getRole() ?? '')
  const { selectedFeature, changeManager, detailsHeight } = model
  if (!selectedFeature) {
    return null
  }
  const {
    _id: id,
    type,
    refSeq,
    start,
    end,
    assemblyId: assembly,
  } = selectedFeature
  const { assemblyManager } = session
  const refName =
    assemblyManager.get(assembly)?.getCanonicalRefName(refSeq) ?? refSeq

  let tmp = Object.fromEntries(
    Array.from(selectedFeature.attributes.entries()).map(([key, value]) => {
      if (key.startsWith('gff_')) {
        const newKey = key.substring(4)
        const capitalizedKey = newKey.charAt(0).toUpperCase() + newKey.slice(1)
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

  const selectedFeatureRows: GridRow[] = [
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
    f?.children?.forEach((child: AnnotationFeatureI) => {
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
    newRow: GridRowModel<(typeof selectedFeatureRows)[0]>,
    oldRow: GridRowModel<(typeof selectedFeatureRows)[0]>,
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
    <MuiDataGrid
      apiRef={apiRef}
      style={{ height: detailsHeight }}
      rows={selectedFeatureRows}
      columns={getFeatureColumns(editable, internetAccount)}
      processRowUpdate={processRowUpdate}
      onProcessRowUpdateError={console.error}
      onCellEditStart={async (params: GridCellEditStartParams<GridRow>) => {
        if (params.colDef.field !== 'attributes' || !selectedFeature) {
          return
        }
        const { assemblyId } = selectedFeature
        session.queueDialog((doneCallback) => [
          ModifyFeatureAttribute,
          {
            session,
            handleClose: doneCallback,
            changeManager,
            sourceFeature: params.row.feature,
            sourceAssemblyId: assemblyId,
          },
        ])
        // Without this, `stopCellEditMode` doesn't work because the cell
        // is still in view mode. Probably an MUI bug, but since we're
        // likely going to replace DataGrid, it's not worth fixing now.
        await new Promise((resolve) => setTimeout(resolve, 0))
        const { id: cellId, field } = params
        apiRef.current.stopCellEditMode({ id: cellId, field })
      }}
    />
  )
}
export default observer(DataGrid)
