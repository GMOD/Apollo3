import {
  Paper,
  Typography,
  Toolbar,
  Tab,
  Tabs,
  TextField,
  Button,
} from '@material-ui/core'
import { toJS } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { FunctionComponent, useState } from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

interface AlnCardProps {
  title?: string
}

interface AlnInputProps extends AlnCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface ApolloData {
  [key: string]: {
    [key: string]: any
  }
}

// CURRENT PROGRESS GOES HERE:
// the fetch does push the info successfully, but need to re-render track after?
// make setup more dynamic than hardcoding that first tab is main, second tab is features, etc
const ApolloFeatureDetails: FunctionComponent<AlnInputProps> = props => {
  const { model } = props
  const [idx, setIdx] = useState(0)
  const feature = JSON.parse(JSON.stringify(model.featureData))
  const fetchedData: ApolloData[] = toJS(model.fetchedData)

  // @ts-ignore
  function handleTabChange(event: any, newIdx: any) {
    setIdx(newIdx)
  }

  return (
    <Paper data-testid="apollo-side-drawer">
      <Toolbar disableGutters>
        <Tabs
          value={idx}
          onChange={handleTabChange}
          indicatorColor="primary"
          variant="scrollable"
          scrollButtons="on"
        >
          {fetchedData.map((object: any, index: number) => {
            const [key, value] = Object.entries(object)[0]
            console.log(key, value)
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
      {idx === 0 && (
        <div>
          <BaseCoreDetails title="Apollo Feature" feature={feature} />
          <BaseAttributes title="Apollo Feature attributes" feature={feature} />
          {feature.children.map((child: any, idx: number) => {
            return (
              <BaseAttributes
                key={idx}
                title={`Apollo Child Feature ${idx} attributes`}
                feature={child}
              />
            )
          })}
        </div>
      )}
      {idx === 1 && (
        <div>
          <BaseCard title="Apollo Features">
            {Object.values(fetchedData[1])[0].map((currentFeature: any) => {
              return (
                <TextField
                  key={currentFeature.name}
                  defaultValue={currentFeature.name}
                  onBlur={async event => {
                    if (event.target.value !== currentFeature.name) {
                      const apolloFeatures = fetchedData[1].features
                      const featIndex = apolloFeatures.findIndex(
                        (feature: any) => feature === currentFeature,
                      )
                      apolloFeatures[featIndex] = {
                        ...currentFeature,
                        name: event.target.value,
                      }
                      const data = {
                        username: sessionStorage.getItem(
                          `${model.apolloId}-apolloUsername`,
                        ), // get from renderProps later
                        password: sessionStorage.getItem(
                          `${model.apolloId}-apolloPassword`,
                        ), // get from renderProps later
                        sequence: model.featureData.sequence,
                        organism: 'Fictitious', // need to find where in code is organism name
                        features: apolloFeatures,
                      }
                      const response = await fetch(
                        `${model.apolloUrl}/annotationEditor/setName`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify(data),
                        },
                      )
                      console.log(response)
                    }
                  }}
                />
              )
            })}
          </BaseCard>
          <Button
            color="secondary"
            variant="contained"
            onClick={async () => await model.fetchFeatures()}
          >
            Re-fetch
          </Button>
        </div>
      )}
    </Paper>
  )
}
ApolloFeatureDetails.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(ApolloFeatureDetails)
