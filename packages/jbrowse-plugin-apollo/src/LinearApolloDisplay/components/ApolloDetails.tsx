import { AppRootModel, getSession } from '@jbrowse/core/util'
import CloseIcon from '@mui/icons-material/Close'
import { Autocomplete, IconButton, TextField } from '@mui/material'
import {
  DataGrid,
  GridColumns,
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
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useMemo, useState } from 'react'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { createFetchErrorMessage } from '../../util'
import { LinearApolloDisplay } from '../stateModel'

function getFeatureColumns(
  editable: boolean,
  internetAccount: ApolloInternetAccountModel,
): GridColumns {
  return [
    { field: 'id', headerName: 'ID', width: 250 },
    {
      field: 'type',
      headerName: 'Type',
      width: 250,
      editable,
      renderEditCell: (params: GridRenderEditCellParams) => (
        <AutocompleteInputCell {...params} internetAccount={internetAccount} />
      ),
    },
    { field: 'refSeq', headerName: 'Ref Seq', width: 150 },
    { field: 'start', headerName: 'Start', type: 'number', editable },
    { field: 'end', headerName: 'End', type: 'number', editable },
  ]
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
      const { parentType } = row
      const { baseURL, getFetcher } = internetAccount
      const uri = new URL(`/ontologies/descendants/${parentType}`, baseURL).href
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
    // const sequenceTypes = changeManager?.validations.getPossibleValues('type')
    const {
      _id: id,
      type,
      parent,
      refSeq,
      start,
      end,
      assemblyId: assembly,
    } = selectedFeature
    // TODO: make this more generic
    const { type: parentType } = parent || { type: 'sequence_feature' }
    const selectedFeatureRows = [
      { id, type, parentType, refSeq, start, end, model },
    ]
    function addChildFeatures(f: typeof selectedFeature) {
      f?.children?.forEach((child: AnnotationFeatureI, childId: string) => {
        selectedFeatureRows.push({
          id: child._id,
          type: child.type,
          parentType: child.parent.type,
          refSeq: child.refSeq,
          start: child.start,
          end: child.end,
          model,
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
          experimentalFeatures={{ newEditingApi: true }}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={console.error}
        />
      </div>
    )
  },
)
