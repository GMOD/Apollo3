import { Paper, Typography, Toolbar, Tab, Tabs } from '@material-ui/core'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { FunctionComponent, useState } from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import AnnotationsTabDetail from './components/AnnotationsTabDetail'

interface AplCardProps {
  title?: string
}

export interface AplInputProps extends AplCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ApolloData {
  [key: string]: {
    [key: string]: any
  }
}

export interface ApolloFeature {
  children: any
  date_creation: number
  date_last_modified: number
  id: number
  location: any
  name: string
  owner: string
  parent_id: string
  parent_name: string
  parent_type: any
  properties: any
  sequence: string
  type: {
    cv: any
    name: string
  }
  uniquename: string
  symbol: string
  description: string
}

// CURRENT PROGRESS GOES HERE:
// sorting in ascending/descending is possible on the coding table
// make it possible on the main feature selection table too
// make the onclick of the coding table
// add the other editing tabs

// make API layer so it can be swapped between Apollo 2 and Apollo 3, most likely using
// some sort of driver setup with apollo js classes or mst classes or pluggable data adapters

const ApolloFeatureDetails: FunctionComponent<AplInputProps> = props => {
  const { model } = props
  const [idx, setIdx] = useState(0)
  const feature = JSON.parse(JSON.stringify(model.featureData))
  const fetchedData = model.fetchedData

  // @ts-ignore
  function handleTabChange(event: any, newIdx: any) {
    setIdx(newIdx)
  }

  function findMatchingTab(tabIdx: number) {
    const keyName = Object.keys(fetchedData[tabIdx])[0]
    switch (keyName) {
      case 'features': {
        return (
          <AnnotationsTabDetail aplData={fetchedData[tabIdx]} props={props} />
        )
      }
      case 'main': {
        return (
          <>
            <BaseCoreDetails title="Apollo Feature" feature={feature} />
            <BaseAttributes
              title="Apollo Feature attributes"
              feature={feature}
            />
            {feature.children.map((child: any, idx: number) => {
              return (
                <BaseAttributes
                  key={idx}
                  title={`Apollo Child Feature ${idx} attributes`}
                  feature={child}
                />
              )
            })}
          </>
        )
      }
      default:
        return <BaseCard> Could not find matching info </BaseCard>
    }
  }

  return (
    <Paper data-testid="apollo-side-drawer">
      <Toolbar disableGutters>
        <Tabs
          value={idx}
          onChange={handleTabChange}
          indicatorColor="primary"
          variant="fullWidth"
        >
          {fetchedData.map((object: any, index: number) => {
            const [key] = Object.entries(object)[0]
            return (
              <Tab
                key={`${key}-${index}`}
                label={
                  <div>
                    <Typography>{key}</Typography>
                  </div>
                }
                tabIndex={idx}
              />
            )
          })}
        </Tabs>
      </Toolbar>
      <div>{findMatchingTab(idx)}</div>
    </Paper>
  )
}
ApolloFeatureDetails.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(ApolloFeatureDetails)
