import React from 'react'

import { Button, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { AnnotationFeature } from '@apollo-annotation/mst'
import { ApolloFeatureDetailsWidget as ApolloFeatureDetails } from './model'

function getFeatureNameOrId(feature: AnnotationFeature) {
  const { attributes } = feature
  const name = attributes.get('gff_name')
  const id = attributes.get('gff_id')
  const exon_id = attributes.get('exon_id')
  const protein_id = attributes.get('protein_id')
  if (name) {
    return `: ${name[0]}`
  }
  if (id) {
    return `: ${id[0]}`
  }
  if (exon_id) {
    return `: ${exon_id[0]}`
  }
  if (protein_id) {
    return `: ${protein_id[0]}`
  }
  return ''
}

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
