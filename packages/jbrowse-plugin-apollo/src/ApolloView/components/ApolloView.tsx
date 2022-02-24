import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import {
  AppRootModel,
  getSession,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import { getEnv, getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'

import { ApolloViewModel } from '../stateModel'
import { CollaborationSetup } from './CollaborationSetup'
import { Welcome } from './Welcome'

export const ApolloView = observer(({ model }: { model: ApolloViewModel }) => {
  const [error, setError] = useState<Error>()
  const [editorType, setEditorType] = useState<'local' | 'collaboration'>()
  const [assembly, setAssembly] = useState<Assembly>()
  const { pluginManager } = getEnv(model)
  const { internetAccounts } = getRoot(model) as AppRootModel
  const { linearGenomeView, dataStore, setDataStore } = model
  const { ReactComponent } = pluginManager.getViewType(linearGenomeView.type)

  const regions = assembly && assembly.regions
  useEffect(() => {
    if (!regions) {
      return
    }
    const [firstRef] = regions
    const newDataStore = setDataStore({
      typeName: 'Client',
      features: {},
      backendDriverType: 'CollaborationServerDriver',
    })
    if (!newDataStore) {
      throw new Error('No data store')
    }
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
    if (!hasTrack) {
      session.addTrackConf({
        type: 'ApolloTrack',
        trackId,
        name: `Apollo Track ${assembly.name}`,
        assemblyNames: [firstRef.assemblyName],
        displays: [
          {
            type: 'LinearApolloDisplay',
            displayId: `apollo_track_${linearGenomeView.id}-LinearApolloDisplay`,
          },
        ],
      })
    }
    linearGenomeView.setDisplayedRegions([firstRef])
    linearGenomeView.showTrack(trackId, {}, { height: 300 })
    linearGenomeView.zoomTo(linearGenomeView.maxBpPerPx)
    linearGenomeView.center()
  }, [regions, model, assembly?.name, linearGenomeView, setDataStore])

  if (error) {
    return <div>{String(error)}</div>
  }

  if (!dataStore) {
    if (!editorType) {
      return <Welcome setEditorType={setEditorType} />
    }

    if (editorType === 'collaboration') {
      return (
        <CollaborationSetup
          internetAccounts={internetAccounts}
          setAssembly={setAssembly}
          setError={setError}
          viewModel={model}
        />
      )
    }
  }

  return <ReactComponent key={linearGenomeView.id} model={linearGenomeView} />
})
