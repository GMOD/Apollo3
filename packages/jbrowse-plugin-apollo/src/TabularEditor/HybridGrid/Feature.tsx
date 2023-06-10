import { AnnotationFeatureI } from 'apollo-mst'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { DisplayStateModel } from '../types'
import { FeatureAttributes } from './FeatureAttributes'

const useStyles = makeStyles()((theme) => ({
  levelIndicator: {
    width: '1em',
    height: '100%',
    position: 'relative',
    flex: 1,
    marginLeft: '1em',
    verticalAlign: 'top',
    background: 'blue',
  },
  typeContent: { display: 'inline-block' },
  feature: {
    td: {
      position: 'relative',
      verticalAlign: 'top',
      paddingLeft: '0.5em',
    },
  },
  arrow: {
    display: 'inline-block',
    width: '1.6em',
    textAlign: 'center',
    cursor: 'pointer',
  },
  arrowExpanded: {
    transform: 'rotate(90deg)',
  },
  hoveredFeature: {
    backgroundColor: theme.palette.grey[300],
  },
}))

export const Feature = observer(
  ({
    feature,
    model,
    depth,
    isHovered,
    isSelected,
    selectedFeatureClass,
  }: {
    model: DisplayStateModel
    feature: AnnotationFeatureI
    depth: number
    isHovered: boolean
    isSelected: boolean
    selectedFeatureClass: string
  }) => {
    const { classes } = useStyles()
    const [expanded, setExpanded] = useState(true)
    const toggleExpanded = (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpanded(!expanded)
    }
    return (
      <>
        <tr
          className={
            classes.feature +
            (isSelected
              ? ` ${selectedFeatureClass}`
              : isHovered
              ? ` ${classes.hoveredFeature}`
              : '')
          }
          onClick={(e) => {
            e.stopPropagation()
            model.setSelectedFeature(feature)
          }}
        >
          <td
            style={{
              whiteSpace: 'nowrap',
              borderLeft: `${depth * 2}em solid transparent`,
            }}
          >
            {feature.children?.size ? (
              <div
                onClick={toggleExpanded}
                className={
                  classes.arrow + (expanded ? ` ${classes.arrowExpanded}` : '')
                }
              >
                ❯
              </div>
            ) : null}
            <div contentEditable="true" className={classes.typeContent}>
              {feature.type}
            </div>
          </td>
          <td contentEditable="true">{feature.start}</td>
          <td contentEditable="true">{feature.end}</td>
          <td>
            <FeatureAttributes feature={feature} />
          </td>
        </tr>
        {!(expanded && feature.children)
          ? null
          : Array.from(feature.children.entries()).map(
              ([featureId, childFeature]) => {
                const childHovered =
                  model.apolloHover?.feature?._id === childFeature._id
                const childSelected =
                  model.selectedFeature?._id === childFeature._id
                return (
                  <Feature
                    isHovered={childHovered}
                    isSelected={childSelected}
                    selectedFeatureClass={selectedFeatureClass}
                    key={featureId}
                    depth={(depth || 0) + 1}
                    feature={childFeature}
                    model={model}
                  />
                )
              },
            )}
      </>
    )
  },
)
