import { TextField } from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import {
  DataGrid,
  GridColumns,
  GridRenderEditCellParams,
  GridRowModel,
  MuiBaseEvent,
  useGridApiContext,
} from '@mui/x-data-grid'
import {
  AnnotationFeatureI,
  Change,
  ChangeManager,
  LocationEndChange,
  LocationStartChange,
  TypeChange,
} from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useEffect, useState } from 'react'

import { ApolloDetailsViewModel } from '../stateModel'

const featureColums: GridColumns = [
  { field: 'id', headerName: 'ID', width: 250 },
  {
    field: 'featureType',
    headerName: 'Type',
    width: 250,
    editable: true,
    renderEditCell: (params: GridRenderEditCellParams) => (
      <AutocompleteInputCell {...params} />
    ),
  },
  { field: 'refName', headerName: 'Ref Seq', width: 150 },
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

export const ApolloDetailsView = observer(
  ({ model }: { model: ApolloDetailsViewModel }) => {
    const { selectedFeature, getAssemblyId, changeManager } = model
    if (!selectedFeature) {
      return <div>click on a feature to see details</div>
    }
    // const sequenceTypes = changeManager?.validations.getPossibleValues('type')
    const { id, featureType, assemblyName, refName, start, end } =
      selectedFeature
    const selectedFeatureRows = [
      { id, featureType, assemblyName, refName, start, end, model },
    ]
    function addChildFeatures(f: typeof selectedFeature) {
      f?.children?.forEach((child: AnnotationFeatureI, childId: string) => {
        child.locations.forEach((childLocation) => {
          if (!childLocation) {
            throw new Error(`No child with id ${childId}`)
          }
          selectedFeatureRows.push({
            id: childLocation.id,
            featureType: childLocation.featureType,
            assemblyName: childLocation.assemblyName,
            refName: childLocation.refName,
            start: childLocation.start,
            end: childLocation.end,
            model,
          })
          addChildFeatures(childLocation)
        })
      })
    }
    addChildFeatures(selectedFeature)
    function processRowUpdate(
      newRow: GridRowModel<typeof selectedFeatureRows[0]>,
      oldRow: GridRowModel<typeof selectedFeatureRows[0]>,
    ) {
      let change: Change | undefined = undefined
      if (newRow.start !== oldRow.start) {
        const {
          start: oldStart,
          id: featureId,
          assemblyName: rowAssemblyName,
        } = oldRow
        const { start: newStart } = newRow
        const assemblyId = getAssemblyId(rowAssemblyName)
        change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          featureId,
          oldStart,
          newStart: Number(newStart),
          assemblyId,
        })
      } else if (newRow.start !== oldRow.start) {
        const {
          end: oldEnd,
          id: featureId,
          assemblyName: rowAssemblyName,
        } = oldRow
        const { end: newEnd } = newRow
        const assemblyId = getAssemblyId(rowAssemblyName)
        change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          featureId,
          oldEnd,
          newEnd: Number(newEnd),
          assemblyId,
        })
      } else if (newRow.featureType !== oldRow.featureType) {
        const {
          featureType: oldType,
          id: featureId,
          assemblyName: rowAssemblyName,
        } = oldRow
        const { featureType: newType } = newRow
        const assemblyId = getAssemblyId(rowAssemblyName)
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
      <div style={{ width: '100%' }}>
        <DataGrid
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
