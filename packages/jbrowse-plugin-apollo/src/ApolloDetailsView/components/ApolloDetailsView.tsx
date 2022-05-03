import { TextField } from '@material-ui/core'
import { Autocomplete } from '@material-ui/lab'
import {
  DataGrid,
  GridCellEditCommitParams,
  GridColumns,
  GridRenderEditCellParams,
} from '@mui/x-data-grid'
import {
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
    renderEditCell: AutocompleteInputCell,
  },
  { field: 'refName', headerName: 'Ref Seq', width: 150 },
  { field: 'start', headerName: 'Start', type: 'number', editable: true },
  { field: 'end', headerName: 'End', type: 'number', editable: true },
]

function AutocompleteInputCell(props: GridRenderEditCellParams) {
  const {
    id,
    value,
    api,
    field,
    row: { model },
  } = props
  const { changeManager } = model as { changeManager?: ChangeManager }
  const [soSequenceTerms, setSOSequenceTerms] = useState<string[]>()

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

  const handleChange = (event: unknown, newValue?: string | null) => {
    api.setEditCellValue({ id, field, value: newValue }, event)
    api.commitCellChange({ id, field })
    api.setCellMode(id, field, 'view')
  }

  if (!soSequenceTerms) {
    return null
  }

  return (
    <Autocomplete
      id="type-combo-box"
      options={soSequenceTerms}
      style={{ width: 245 }}
      renderInput={(params) => (
        <TextField {...params} label="Combo box" variant="outlined" />
      )}
      value={String(value)}
      onChange={handleChange}
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
    const {
      id,
      featureType,
      assemblyName,
      location: { refName, start, end },
    } = selectedFeature
    const selectedFeatureRows = [
      { id, featureType, assemblyName, refName, start, end, model },
    ]
    function addChildFeatures(f: typeof selectedFeature) {
      f?.children?.forEach((child: typeof selectedFeature, childId: string) => {
        if (!child) {
          throw new Error(`No child with id ${childId}`)
        }
        selectedFeatureRows.push({
          id: childId,
          featureType: child.featureType,
          assemblyName: child.assemblyName,
          refName: child.location.refName,
          start: child.location.start,
          end: child.location.end,
          model,
        })
        addChildFeatures(child)
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
          changes: [{ featureId, oldStart, newStart: Number(newValue) }],
          assemblyId,
        })
      } else if (field === 'end' && changedFeature.end !== Number(newValue)) {
        const { end: oldEnd, id: featureId } = changedFeature
        const assemblyId = getAssemblyId(changedFeature.assemblyName)
        change = new LocationEndChange({
          typeName: 'LocationEndChange',
          changedIds: [featureId],
          changes: [{ featureId, oldEnd, newEnd: Number(newValue) }],
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
          changes: [{ featureId, oldType, newType: String(newValue) }],
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
