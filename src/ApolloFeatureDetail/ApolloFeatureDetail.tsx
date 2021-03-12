import { Paper } from '@material-ui/core'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { FunctionComponent } from 'react'
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
  const feature = JSON.parse(JSON.stringify(model.featureData))
  return (
    <Paper data-testid="apollo-side-drawer">
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
