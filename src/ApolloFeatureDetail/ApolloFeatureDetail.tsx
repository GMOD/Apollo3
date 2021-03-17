import { Paper, Typography, Toolbar, Tab, Tabs } from '@material-ui/core'
import { toJS } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { FunctionComponent, useState } from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

interface AlnCardProps {
  title?: string
}

interface AlnInputProps extends AlnCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const ApolloFeatureDetails: FunctionComponent<AlnInputProps> = props => {
  const { model } = props
  const [idx, setIdx] = useState(0)
  const feature = JSON.parse(JSON.stringify(model.featureData))
  const fetchedData = toJS(model.fetchedData)

  // @ts-ignore
  function handleTabChange(event: any, newIdx: any) {
    setIdx(newIdx)
  }

  // so after populating all the features in a tab,
  // allow user to select a feature in the widget, maybe double click the name and edit it, the editing should send a fetch
  // to the endpoint to update that feature's name

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
    </Paper>
  )
}
ApolloFeatureDetails.propTypes = {
  model: MobxPropTypes.objectOrObservableObject.isRequired,
}

export default observer(ApolloFeatureDetails)
