import { type AnnotationFeature } from '@apollo-annotation/mst'
import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import React from 'react'

import { getFeatureNameOrId } from '../util'

import { type ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'

export const FeatureDetailsNavigation = observer(
  function FeatureDetailsNavigation(props: {
    model: ApolloFeatureDetails
    feature: AnnotationFeature
  }) {
    const { feature, model } = props
    const { children, parent } = feature
    const childFeatures = []
    if (children) {
      for (const [, child] of children) {
        childFeatures.push(child)
      }
    }

    if (!(parent ?? childFeatures.length > 0)) {
      return null
    }

    return (
      <div style={{ marginTop: 10 }}>
        {parent && (
          <div>
            <Typography variant="h6">Parent:</Typography>
            <Button
              variant="contained"
              onClick={() => {
                model.setFeature(parent)
              }}
            >
              {parent.type}
              {getFeatureNameOrId(parent)} ({parent.min}..{parent.max})
            </Button>
          </div>
        )}
        {childFeatures.length > 0 && (
          <div>
            <Typography variant="h6">
              {childFeatures.length === 1 ? 'Child' : 'Children'}:
            </Typography>
            {childFeatures.map((child) => (
              <div key={child._id} style={{ marginBottom: 5 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    model.setFeature(child)
                  }}
                >
                  {child.type}
                  {getFeatureNameOrId(child)} ({child.min}..{child.max})
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  },
)
