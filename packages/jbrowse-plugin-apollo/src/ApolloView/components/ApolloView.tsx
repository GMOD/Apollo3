import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import React from 'react'

import { ApolloViewModel } from '../stateModel'

const useStyles = makeStyles((theme) => ({
  setup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    margin: theme.spacing(4),
  },
}))

export const ApolloView = observer(({ model }: { model: ApolloViewModel }) => {
  const classes = useStyles()
  const { pluginManager } = getEnv(model)
  const { linearGenomeView, dataStore, setDataStore } = model
  const { ReactComponent } = pluginManager.getViewType(linearGenomeView.type)

  function setUpView() {
    const newDataStore = setDataStore({
      typeName: 'Client',
      features: {},
      backendDriverType: 'CollaborationServerDriver',
    })
    if (!newDataStore) {
      throw new Error('No data store')
    }
    const { backendDriver } = newDataStore
    // linearGenomeView.staticBlocks.contentBlocks.forEach((block) => {
    ;[
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50000 },
    ].forEach((block) => {
      backendDriver?.loadFeatures({
        assemblyName: block.assemblyName,
        refName: block.refName,
        start: block.start,
        end: block.end,
      })
    })
    const session = getSession(model)
    if (!isSessionWithAddTracks(session)) {
      throw new Error('')
    }
    const trackId = `apollo_track_${linearGenomeView.id}`
    const hasTrack = Boolean(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      session.tracks.find((track) => track.trackId === trackId),
    )
    if (hasTrack) {
      return
    }
    session.addTrackConf({
      type: 'ApolloTrack',
      trackId,
      name: `Apollo Track Volvox`,
      assemblyNames: ['volvox'],
      displays: [
        {
          type: 'LinearApolloDisplay',
          displayId: `apollo_track_${linearGenomeView.id}-LinearApolloDisplay`,
        },
      ],
    })
  }

  if (!dataStore?.features.size) {
    return (
      <div className={classes.setup}>
        <Button
          className={classes.button}
          color="primary"
          variant="contained"
          onClick={setUpView}
        >
          Load Volvox GFF3
        </Button>
      </div>
    )
  }

  return <ReactComponent key={linearGenomeView.id} model={linearGenomeView} />
})
