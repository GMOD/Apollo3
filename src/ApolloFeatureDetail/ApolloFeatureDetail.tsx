import {
  Paper,
  Typography,
  Toolbar,
  Tab,
  Tabs,
  TextField,
  Button,
  makeStyles,
} from '@material-ui/core'
import { toJS } from 'mobx'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { FunctionComponent, useState } from 'react'
import {
  BaseCoreDetails,
  BaseAttributes,
  BaseCard,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

interface AplCardProps {
  title?: string
}

interface AplInputProps extends AplCardProps {
  model: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

interface ApolloData {
  [key: string]: {
    [key: string]: any
  }
}

interface ApolloFeature {
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
// made table and on click show text fields
// symbol and description are not fetching successfully, work on that
// refactor some code, have some reused line
// have the table and track reflect changes after refetching

// make API layer so it can be swapped between Apollo 2 and Apollo 3, most likely using
// some sort of driver setup with apollo js classes or mst classes or pluggable data adapters

// dont know where to get: status, symbol, description

const useStyles = makeStyles(() => ({
  dataRow: {
    '&:hover': {
      backgroundColor: 'lightblue',
    },
  },
}))

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
  console.log(response)
}

const FeatureNameTab = ({
  aplData,
  props,
}: {
  aplData: ApolloData
  props: AplInputProps
}) => {
  const { model } = props
  const [clickedFeature, setClickedFeature] = useState<
    ApolloFeature | undefined
  >()
  const classes = useStyles()
  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Seq</th>
            <th>Type</th>
            <th>Length</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(aplData)[0].map((currentFeature: ApolloFeature) => {
            const {
              name,
              sequence,
              type,
              location,
              date_last_modified,
            } = currentFeature
            return (
              <tr
                key={name}
                className={classes.dataRow}
                onClick={() => {
                  setClickedFeature(currentFeature)
                }}
              >
                <td>{name}</td>
                <td>{sequence}</td>
                <td>{type.name}</td>
                <td>{location.fmax - location.fmin}</td>
                <td>{new Date(date_last_modified).toDateString()}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {clickedFeature ? (
        <BaseCard title="Edit Feature">
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
                  // maybe generalize this, what it does is find the feature that will be changed,
                  // change the specific field with the event.target.value, and put it back in the array
                  const apolloFeatures = aplData.features
                  const featIndex = apolloFeatures.findIndex(
                    (feature: any) => feature === clickedFeature,
                  )
                  apolloFeatures[featIndex] = {
                    ...clickedFeature,
                    name: event.target.value,
                  }
                  await updateFeatures(
                    model,
                    apolloFeatures,
                    `${model.apolloUrl}/annotationEditor/setName`,
                  )
                }
              }}
            />
            <TextField
              key={`${clickedFeature.name}-${clickedFeature.symbol}`}
              label="Symbol"
              defaultValue={clickedFeature.symbol || "''"}
              onBlur={async event => {
                if (event.target.value !== clickedFeature.symbol) {
                  const data = {
                    uniquename: clickedFeature.uniquename,
                    symbol: event.target.value,
                  }
                  await updateFeatures(
                    model,
                    data,
                    `${model.apolloUrl}/annotationEditor/setSymbol`,
                  )
                }
              }}
            />
            <TextField
              key={`${clickedFeature.name}-${clickedFeature.description}`}
              label="Description"
              defaultValue={clickedFeature.description || "''"}
              onBlur={async event => {
                if (event.target.value !== clickedFeature.description) {
                  const data = {
                    uniquename: clickedFeature.uniquename,
                    description: event.target.value,
                  }
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
              defaultValue={`${clickedFeature.location.fmin}-${
                clickedFeature.location.fmax
              } strand(${clickedFeature.location.strand === 1 ? '+' : '-'})`}
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
        </BaseCard>
      ) : null}
      <Button
        color="secondary"
        variant="contained"
        onClick={async () => await model.fetchFeatures()}
      >
        Re-fetch
      </Button>
    </>
  )
}
const ApolloFeatureDetails: FunctionComponent<AplInputProps> = props => {
  const { model } = props
  const [idx, setIdx] = useState(0)
  const feature = JSON.parse(JSON.stringify(model.featureData))
  const fetchedData: ApolloData[] = toJS(model.fetchedData)

  // @ts-ignore
  function handleTabChange(event: any, newIdx: any) {
    setIdx(newIdx)
  }

  function findMatchingTab(tabIdx: number) {
    const keyName = Object.keys(fetchedData[tabIdx])[0]
    switch (keyName) {
      case 'features': {
        return <FeatureNameTab aplData={fetchedData[tabIdx]} props={props} />
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
          variant="scrollable"
          scrollButtons="on"
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
