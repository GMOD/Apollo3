import { TextField } from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import {
  DataGrid,
  GridCellEditCommitParams,
  GridColumns,
  GridRenderEditCellParams,
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
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>(['CNA'])
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

  const handleChange = (event: MuiBaseEvent, newValue?: string | null) => {
    apiRef.current.setEditCellValue({ id, field, value: newValue }, event)
    apiRef.current.commitCellChange({ id, field })
    apiRef.current.setCellMode(id, field, 'view')
  }

  if (!soSequenceTerms) {
    return null
  }

  return (
    <Autocomplete
      id="type-combo-box"
      options={soSequenceTerms}
      style={{ width: 245 }}
      renderInput={(params) => <TextField {...params} variant="outlined" />}
      value={String(value)}
      onChange={handleChange}
      selectOnFocus
      clearOnBlur
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
            id: childId,
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
    function onCellEditCommit({
      id: rowId,
      field,
      value: newValue,
    }: GridCellEditCommitParams) {
      const changedFeature = selectedFeatureRows.find((r) => r.id === rowId)
      if (!changedFeature) {
        throw new Error(`Could not find feature with id ${rowId}`)
      }
      let change: Change | undefined = undefined
      if (field === 'start' && changedFeature.start !== Number(newValue)) {
        const { start: oldStart, id: featureId } = changedFeature
        const assemblyId = getAssemblyId(changedFeature.assemblyName)
        change = new LocationStartChange({
          typeName: 'LocationStartChange',
          changedIds: [featureId],
          featureId,
          oldStart,
          newStart: Number(newValue),
          assemblyId,
        })
      } else if (field === 'end' && changedFeature.end !== Number(newValue)) {
        const { end: oldEnd, id: featureId } = changedFeature
        const assemblyId = getAssemblyId(changedFeature.assemblyName)
        change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          featureId,
          oldEnd,
          newEnd: Number(newValue),
          assemblyId,
        })
      } else if (
        field === 'featureType' &&
        changedFeature.featureType !== String(newValue)
      ) {
        const { featureType: oldType, id: featureId } = changedFeature
        if (!oldType) {
          throw new Error(`Feature did not have a type: "${rowId}"`)
        }
        const assemblyId = getAssemblyId(changedFeature.assemblyName)
        change = new TypeChange({
          typeName: 'TypeChange',
          changedIds: [featureId],
          featureId,
          oldType,
          newType: String(newValue),
          assemblyId,
        })
      }
      if (change) {
        changeManager?.submit(change)
      }
    }
    return (
      <div style={{ width: '100%' }}>
        <DataGrid
          autoHeight
          rows={selectedFeatureRows}
          columns={featureColums}
          onCellEditCommit={onCellEditCommit}
        />
      </div>
    )
  },
)
