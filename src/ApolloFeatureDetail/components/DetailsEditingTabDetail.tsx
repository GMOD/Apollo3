import { TextField } from '@material-ui/core'
import { observer } from 'mobx-react'
import React from 'react'
import { AplInputProps, ApolloFeature } from '../ApolloFeatureDetail'

const updateFeatures = async (
  model: any,
  apolloData: any,
  fetchUrl: string,
) => {
  const data = {
    username: sessionStorage.getItem(`${model.apolloId}-apolloUsername`), // get from renderProps later
    password: sessionStorage.getItem(`${model.apolloId}-apolloPassword`), // get from renderProps later
    sequence: model.featureData.sequence,
    organism: 'Fictitious', // need to find where in code is organism name
    features: apolloData,
  }
  const response = await fetch(fetchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  console.log('update features', response)
}

const DetailsEditingTabDetail = ({
  clickedFeature,
  props,
}: {
  clickedFeature: ApolloFeature
  props: AplInputProps
}) => {
  const { model } = props
  // increases the fmin by 1 for display since coordinates are handled as zero-based on server-side
  const fmin = clickedFeature.location.fmin + 1
  return (
    <div>
      <TextField
        key={clickedFeature.type.name}
        label="Type"
        disabled
        defaultValue={clickedFeature.type.name}
      />
      <TextField
        key={clickedFeature.name}
        label="Name"
        defaultValue={clickedFeature.name}
        onBlur={async event => {
          if (event.target.value !== clickedFeature.name) {
            const data = [
              {
                uniquename: clickedFeature.uniquename,
                name: event.target.value,
              },
            ]
            await updateFeatures(
              model,
              data,
              `${model.apolloUrl}/annotationEditor/setName`,
            )
          }
        }}
      />
      <TextField
        key={`${clickedFeature.uniquename}-symbol`}
        label="Symbol"
        defaultValue={clickedFeature.symbol || "''"}
        onBlur={async event => {
          if (event.target.value !== clickedFeature.symbol) {
            const data = [
              {
                uniquename: clickedFeature.uniquename,
                symbol: event.target.value,
              },
            ]
            await updateFeatures(
              model,
              data,
              `${model.apolloUrl}/annotationEditor/setSymbol`,
            )
          }
        }}
      />
      <TextField
        key={`${clickedFeature.uniquename}-desc`}
        label="Description"
        defaultValue={clickedFeature.description || "''"}
        onBlur={async event => {
          if (event.target.value !== clickedFeature.description) {
            const data = [
              {
                uniquename: clickedFeature.uniquename,
                description: event.target.value,
              },
            ]
            await updateFeatures(
              model,
              data,
              `${model.apolloUrl}/annotationEditor/setDescription`,
            )
          }
        }}
      />
      <TextField
        key={clickedFeature.location.fmin}
        label="location"
        disabled
        defaultValue={`${fmin}-${clickedFeature.location.fmax} strand(${
          clickedFeature.location.strand === 1 ? '+' : '-'
        })`}
      />
      <TextField
        key={clickedFeature.sequence}
        label="Ref Sequence"
        disabled
        defaultValue={clickedFeature.sequence}
      />
      <TextField
        key={clickedFeature.owner}
        label="Owner"
        disabled
        defaultValue={clickedFeature.owner}
      />
      <TextField
        key={clickedFeature.date_creation}
        label="Created"
        disabled
        defaultValue={`${new Date(
          clickedFeature.date_creation,
        ).toDateString()} ${new Date(
          clickedFeature.date_creation,
        ).toTimeString()}`}
      />
      <TextField
        key={clickedFeature.date_last_modified}
        label="Updated"
        disabled
        defaultValue={`${new Date(
          clickedFeature.date_last_modified,
        ).toDateString()} ${new Date(
          clickedFeature.date_last_modified,
        ).toTimeString()}`}
      />
    </div>
  )
}

export default observer(DetailsEditingTabDetail)
