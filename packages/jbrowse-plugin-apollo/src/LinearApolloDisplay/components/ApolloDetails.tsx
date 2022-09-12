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
  Change,
  ChangeManager,
  LocationEndChange,
  LocationStartChange,
  TypeChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

import { LinearApolloDisplay } from '../stateModel'

const featureColums: GridColumns = [
  { field: 'id', headerName: 'ID', width: 250 },
  {
    field: 'type',
    headerName: 'Type',
    width: 250,
    editable: true,
    renderEditCell: (params: GridRenderEditCellParams) => (
      <AutocompleteInputCell {...params} />
    ),
  },
  { field: 'refSeq', headerName: 'Ref Seq', width: 150 },
  { field: 'start', headerName: 'Start', type: 'number', editable: true },
  { field: 'end', headerName: 'End', type: 'number', editable: true },
]

function AutocompleteInputCell(props: GridRenderEditCellParams) {
  const {
    id,
    value,
    field,
    row: { model },
  } = props
  const { changeManager } = model as { changeManager?: ChangeManager }
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>([])
  const apiRef = useGridApiContext()

  useEffect(() => {
    async function getSOSequenceTerms() {
      if (!changeManager) {
        return
      }
      const { validations } = changeManager
      const soTerms = (await validations.possibleValues('type')) as string[]
      if (soTerms) {
        setSOSequenceTerms(soTerms)
      }
    }
    getSOSequenceTerms()
  }, [changeManager])

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
      disablePortal
      disableClearable
      selectOnFocus
      handleHomeEndKeys
    />
  )
}

export const ApolloDetails = observer(
  ({ model }: { model: LinearApolloDisplay }) => {
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
    const { _id: id, type, refSeq, start, end } = selectedFeature
    const assemblyId = ''
    const selectedFeatureRows = [{ id, type, refSeq, start, end, model }]
    function addChildFeatures(f: typeof selectedFeature) {
      f?.children?.forEach((child: AnnotationFeatureI, childId: string) => {
        selectedFeatureRows.push({
          id: child._id,
          type: child.type,
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
      let change: Change | undefined = undefined
      if (newRow.start !== oldRow.start) {
        const { start: oldStart, id: featureId } = oldRow
        const { start: newStart } = newRow
        change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          featureId,
          oldStart,
          newStart: Number(newStart),
          assemblyId,
        })
      } else if (newRow.start !== oldRow.start) {
        const { end: oldEnd, id: featureId } = oldRow
        const { end: newEnd } = newRow
        change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          featureId,
          oldEnd,
          newEnd: Number(newEnd),
          assemblyId,
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
          assemblyId,
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
          autoHeight
          rows={selectedFeatureRows}
          columns={featureColums}
          experimentalFeatures={{ newEditingApi: true }}
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={console.error}
        />
      </div>
    )
  },
)
