/* eslint-disable @typescript-eslint/unbound-method */

import type { AnnotationFeature } from '@apollo-annotation/mst'
import { FeatureAttributeChange } from '@apollo-annotation/shared'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import React, { useState } from 'react'

import type { ChangeManager } from '../ChangeManager'
import type { ApolloSessionModel } from '../session'

import { Dialog } from './Dialog'

const PRESET_COLORS = [
  '#cc79a7',
  '#d65e00',
  '#e69f00',
  '#f0e442',
  '#56b3e9',
  '#0072b2',
  '#009e73',
] as const

interface ColorFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeature
  sourceAssemblyId: string
  changeManager: ChangeManager
}

export function ColorFeature({
  changeManager,
  handleClose,
  sourceAssemblyId,
  sourceFeature,
}: ColorFeatureProps) {
  const existingColor = sourceFeature.attributes.get('apollo_color')?.[0]
  const [color, setColor] = useState<string>(existingColor ?? PRESET_COLORS[0])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const currentColor = sourceFeature.attributes.get('apollo_color')?.[0]
    if (currentColor === color) {
      handleClose()
      return
    }
    const oldAttributes = getSnapshot(sourceFeature.attributes)
    const newAttributes = { ...oldAttributes, apollo_color: [color] }
    const change = new FeatureAttributeChange({
      changedIds: [sourceFeature._id],
      typeName: 'FeatureAttributeChange',
      assembly: sourceAssemblyId,
      featureId: sourceFeature._id,
      oldAttributes,
      newAttributes,
    })
    await changeManager.submit(change)
    handleClose()
  }

  async function onRemove() {
    const oldAttributes = getSnapshot(sourceFeature.attributes)
    const { apollo_color: _removed, ...newAttributes } = oldAttributes
    const change = new FeatureAttributeChange({
      changedIds: [sourceFeature._id],
      typeName: 'FeatureAttributeChange',
      assembly: sourceAssemblyId,
      featureId: sourceFeature._id,
      oldAttributes,
      newAttributes,
    })
    await changeManager.submit(change)
    handleClose()
  }

  return (
    <Dialog
      open
      title="Color feature"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="color-feature"
    >
      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
      >
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>
            Choose a color for this feature.
          </DialogContentText>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {PRESET_COLORS.map((preset) => {
              const selected = color.toLowerCase() === preset
              return (
                <button
                  key={preset}
                  type="button"
                  aria-label={preset}
                  aria-pressed={selected}
                  onClick={() => {
                    setColor(preset)
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    borderRadius: 4,
                    border: '1px solid rgba(0, 0, 0, 0.3)',
                    outline: selected ? '2px solid currentColor' : 'none',
                    outlineOffset: 2,
                    backgroundColor: preset,
                    cursor: 'pointer',
                  }}
                />
              )
            })}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
            }}
          >
            <label htmlFor="color-feature-custom">Custom:</label>
            <input
              id="color-feature-custom"
              type="color"
              value={color}
              onChange={(event) => {
                setColor(event.target.value)
              }}
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit">
            Submit
          </Button>
          <Button
            variant="outlined"
            color="error"
            type="button"
            disabled={existingColor === undefined}
            onClick={() => {
              void onRemove()
            }}
          >
            Remove color
          </Button>
          <Button variant="outlined" type="button" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
