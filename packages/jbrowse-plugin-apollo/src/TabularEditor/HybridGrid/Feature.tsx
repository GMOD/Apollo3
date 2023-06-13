import { AnnotationFeatureI } from 'apollo-mst'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { DisplayStateModel } from '../types'
import { FeatureAttributes } from './FeatureAttributes'
import { OntologyTermAutocomplete } from './OntologyTermAutocomplete'

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
  typeContent: {
    display: 'inline-block',
    width: '174px',
    height: '100%',
    cursor: 'text',
  },
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
    internetAccount,
  }: {
    model: DisplayStateModel
    feature: AnnotationFeatureI
    depth: number
    isHovered: boolean
    isSelected: boolean
    selectedFeatureClass: string
    internetAccount: ApolloInternetAccountModel
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
            <div className={classes.typeContent}>
              <OntologyTermAutocomplete
                feature={feature}
                style={{ width: 170 }}
                value={feature.type}
                internetAccount={internetAccount}
                onChange={(oldValue, newValue) => {
                  return
                }}
              />
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
                    internetAccount={internetAccount}
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
