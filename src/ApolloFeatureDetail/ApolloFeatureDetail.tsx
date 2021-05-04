import { Paper, Typography, Toolbar, Tab, Tabs } from '@material-ui/core'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { FunctionComponent, useState } from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import AnnotationsTabDetail from './components/AnnotationsTabDetail'
import OrganismsTabDetail from './components/OrganismsTabDetail'

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

// CURRENT PROGRESS AND UPDATES GO HERE:
// finish making gene product and provenance forms and tabs
// gene product's product name line has a weird return on the autocomplete, look at that
// still need to work on making it more modular
// maybe a baseeditingtab detail that each one extends, since there is a lot of repeats
// but also  a lot of unique parts for each form

const ApolloFeatureDetails: FunctionComponent<AplInputProps> = props => {
  const { model } = props
  const [idx, setIdx] = useState(0)
  const feature = JSON.parse(JSON.stringify(model.featureData))
  const fetchedData: Array<any>[] = Array.from(model.fetchedData.entries())

  function handleTabChange(event: any, newIdx: any) {
    setIdx(newIdx)
  }

  // pairs tab with panel
  function findMatchingTab(tabIdx: number) {
    const keyName = fetchedData[tabIdx] ? fetchedData[tabIdx][0] : ''
    switch (keyName) {
      case 'features': {
        return (
          <AnnotationsTabDetail
            aplData={fetchedData[tabIdx][1]}
            props={props}
          />
        )
      }
      case 'organisms': {
        return (
          <OrganismsTabDetail aplData={fetchedData[tabIdx][1]} props={props} />
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
            const key = object[0]
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
