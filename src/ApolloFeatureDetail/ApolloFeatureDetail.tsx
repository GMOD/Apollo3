import { Paper, Typography } from '@material-ui/core'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { FunctionComponent, useState } from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import Toolbar from '@material-ui/core/Toolbar'
import Tab from '@material-ui/core/Tab'
import Tabs from '@material-ui/core/Tabs'

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

  function handleTabChange(event: any, newIdx: any) {
    console.log(event)
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
          {model.fetchedData.map((key: string, index: number) => {
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
