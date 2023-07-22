import { getSession } from '@jbrowse/core/util'
import { AnnotationFeatureI } from 'apollo-mst'
import { observer } from 'mobx-react'
import React from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloInternetAccountModel } from '../../ApolloInternetAccount/model'
import { DisplayStateModel } from '../types'
import {
  handleFeatureEndChange,
  handleFeatureStartChange,
  handleFeatureTypeChange,
} from './ChangeHandling'
import { FeatureAttributes } from './FeatureAttributes'
import { featureContextMenuItems } from './featureContextMenuItems'
import type { ContextMenuState } from './HybridGrid'
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

function makeContextMenuItems(
  display: DisplayStateModel,
  feature: AnnotationFeatureI,
) {
  const { changeManager, getAssemblyId, session, regions } = display
  return featureContextMenuItems(
    feature,
    regions[0],
    getAssemblyId,
    display.selectedFeature,
    display.setSelectedFeature,
    session,
    changeManager,
  )
}

function getTopLevelFeature(feature: AnnotationFeatureI): AnnotationFeatureI {
  let cur = feature
  while (cur.parent) {
    cur = cur.parent
  }
  return cur
}

export const Feature = observer(function Feature({
  feature,
  model: displayState,
  depth,
  isHovered,
  isSelected,
  selectedFeatureClass,
  internetAccount,
  setContextMenu,
}: {
  model: DisplayStateModel
  feature: AnnotationFeatureI
  depth: number
  isHovered: boolean
  isSelected: boolean
  selectedFeatureClass: string
  internetAccount: ApolloInternetAccountModel
  setContextMenu: (menu: ContextMenuState) => void
}) {
  const { classes } = useStyles()
  const { tabularEditor: tabularEditorState } = displayState
  const { filterText } = tabularEditorState
  const expanded = !tabularEditorState.featureCollapsed.get(feature._id)
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    tabularEditorState.setFeatureCollapsed(feature._id, expanded)
  }

  // pop up a snackbar in the session notifying user of an error
  const notifyError = (e: Error) =>
    getSession(displayState).notify(e.message, 'error')

  return (
    <>
      <tr
        onMouseEnter={() => {
          displayState.setApolloHover({
            feature,
            topLevelFeature: getTopLevelFeature(feature),
          })
        }}
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
          displayState.setSelectedFeature(feature)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          setContextMenu({
            position: { left: e.clientX + 2, top: e.clientY - 6 },
            items: makeContextMenuItems(displayState, feature),
          })
          return false
        }}
      >
        <td
          style={{
            whiteSpace: 'nowrap',
            borderLeft: `${depth * 2}em solid transparent`,
          }}
        >
          <td
            style={{
              whiteSpace: 'nowrap',
              borderLeft: `${depth * 2}em solid transparent`,
            }}
          >
            {feature.children?.size ? (
            // TODO: a11y
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
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
                displayState={displayState}
                feature={feature}
                style={{ width: 170 }}
                value={feature.type}
                internetAccount={internetAccount}
                onChange={(oldValue, newValue) => {
                  if (newValue) {
                    handleFeatureTypeChange(
                      displayState.changeManager,
                      feature,
                      oldValue,
                      newValue,
                    ).catch(notifyError)
                  }
                }}
              />
            </div>
          </td>
        </td>
        <td
          contentEditable={true}
          onBlur={(e) => {
            const newValue = Number(e.target.textContent)
            if (!Number.isNaN(newValue) && newValue !== feature.start) {
              handleFeatureStartChange(
                displayState.changeManager,
                feature,
                feature.start,
                newValue,
              ).catch(notifyError)
            }
          }}
        >
          {feature.start}
        </td>
        <td
          contentEditable={true}
          onBlur={(e) => {
            const newValue = Number(e.target.textContent)
            if (!Number.isNaN(newValue) && newValue !== feature.end) {
              handleFeatureEndChange(
                displayState.changeManager,
                feature,
                feature.end,
                newValue,
              ).catch(notifyError)
            }
          }}
        >
          {feature.end}
        </td>
        <td>
          <FeatureAttributes filterText={filterText} feature={feature} />
        </td>
      </tr>
      {!(expanded && feature.children)
        ? null
        : Array.from(feature.children.entries())
            .filter((entry) => {
              if (!filterText) {
                return true
              }
              const [, childFeature] = entry
              // search feature and its subfeatures for the text
              const text = JSON.stringify(childFeature)
              return text.includes(filterText)
            })
            .map(([featureId, childFeature]) => {
              const childHovered =
                displayState.apolloHover?.feature?._id === childFeature._id
              const childSelected =
                displayState.selectedFeature?._id === childFeature._id
              return (
                <Feature
                  isHovered={childHovered}
                  isSelected={childSelected}
                  selectedFeatureClass={selectedFeatureClass}
                  key={featureId}
                  internetAccount={internetAccount}
                  depth={(depth || 0) + 1}
                  feature={childFeature}
                  model={displayState}
                  setContextMenu={setContextMenu}
                />
              )
            })}
    </>
  )
})
