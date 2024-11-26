import React from 'react'

import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { AnnotationFeature } from '@apollo-annotation/mst'
import { ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'

export const FeatureDetailsNavigation = observer(
  function FeatureDetailsNavigation(props: {
    model: ApolloFeatureDetails
    feature: AnnotationFeature
  }) {
    const { feature, model } = props
    const { children, parent } = feature
    const childrenSnapshot = []
    if (children) {
      for (const [, child] of children) {
        childrenSnapshot.push(child)
      }
    }

    return (
      <div>
        {parent && (
          <div>
            <Typography variant="h5">Parent: </Typography>
            <Button
              variant="contained"
              onClick={() => {
                model.setFeature(parent)
              }}
            >
              {parent.type} ({parent.min}..{parent.max})
            </Button>
          </div>
        )}
        {childrenSnapshot.length > 0 && (
          <div>
            <Typography variant="h5">Children: </Typography>
            {childrenSnapshot.map((child) => (
              <div key={child._id} style={{ marginBottom: 5 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    model.setFeature(child)
                  }}
                >
                  {child.type} ({child.min}..{child.max})
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  },
)
