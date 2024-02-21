import { AbstractSessionModel, SessionWithWidgets } from '@jbrowse/core/util'
import {
  Button,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import { ApolloSessionModel } from '../session'

interface Child {
  _id: string
  start: number
  end: number
  type: string
}

export const RelatedFeatures = observer(function RelatedFeatures({
  assembly,
  feature,
  refName,
  session,
}: {
  feature: AnnotationFeatureI
  refName: string
  session: ApolloSessionModel
  assembly: string
}) {
  const [selectedOption, setSelectedOption] = useState('default')
  const { children, parent } = feature

  const childItems: Child[] = []
  if (children) {
    // eslint-disable-next-line unicorn/no-array-for-each
    children.forEach((child) => {
      childItems.push({
        _id: child._id,
        start: child.start + 1,
        end: child.end,
        type: child.type,
      })
    })
  }
  const onParentButtonClick = () => {
    if (parent) {
      const ses = session as unknown as AbstractSessionModel
      if (ses) {
        const sesWidged = session as unknown as SessionWithWidgets
        const apolloFeatureWidget = sesWidged.addWidget(
          'ApolloFeatureDetailsWidget',
          'apolloFeatureDetailsWidget',
          {
            feature: parent,
            assembly,
            refName,
          },
        )
        ses.showWidget?.(apolloFeatureWidget)
      }
    }
  }

  async function handleChangeSeqOption(e: SelectChangeEvent<string>) {
    const option = e.target.value
    if (children) {
      // eslint-disable-next-line unicorn/no-array-for-each
      children.forEach((child) => {
        if (child._id === option) {
          feature = child
        }
      })
    }

    const ses = session as unknown as AbstractSessionModel
    if (ses) {
      const sesWidged = session as unknown as SessionWithWidgets
      const apolloFeatureWidget = sesWidged.addWidget(
        'ApolloFeatureDetailsWidget',
        'apolloFeatureDetailsWidget',
        {
          feature,
          assembly,
          refName,
        },
      )
      ses.showWidget?.(apolloFeatureWidget)
    }
  }
  return (
    <>
      <div>
        {(childItems.length > 0 || parent) && (
          <Typography variant="h4">Related features</Typography>
        )}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {parent && (
            <Button
              variant="contained"
              onClick={onParentButtonClick}
              style={{ width: '120px', marginLeft: '5px', height: '25px' }}
            >
              Show parent
            </Button>
          )}
          {childItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginLeft: '15px',
              }}
            >
              <h4>{parent ? 'or select child' : 'Select child'}</h4>
              <Select
                value={selectedOption}
                onChange={handleChangeSeqOption}
                style={{
                  width: '300px',
                  marginLeft: '5px',
                  height: '25px',
                }}
              >
                <MenuItem value="default">Select an option</MenuItem>
                {childItems.map((child) => (
                  <MenuItem key={child._id} value={child._id}>
                    {`Start: ${child.start}, End: ${child.end}, Type: ${child.type}`}
                  </MenuItem>
                ))}
              </Select>
            </div>
          )}
        </div>
      </div>
    </>
  )
})
