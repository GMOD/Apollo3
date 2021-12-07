import gff3, { GFF3FeatureLineWithRefs, GFF3Item } from '@gmod/gff'
import { Button, makeStyles } from '@material-ui/core'
import { observer } from 'mobx-react'
import { SnapshotIn, getEnv } from 'mobx-state-tree'
import React from 'react'

import AnnotationFeature from '../../AnnotationDrivers/AnnotationFeature'
import { ApolloViewModel } from '../stateModel'
import gff3File from './volvoxGff3'

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
  const { linearGenomeView, features, setFeatures } = model
  const { ReactComponent } = pluginManager.getViewType(linearGenomeView.type)

  function setFeaturesOnModel() {
    const gff3Contents = gff3.parseStringSync(gff3File, {
      parseAll: true,
    })
    const newFeatures = makeFeatures(gff3Contents, 'volvox')
    setFeatures(newFeatures)
  }

  if (!features.size) {
    return (
      <div className={classes.setup}>
        <Button
          className={classes.button}
          color="primary"
          variant="contained"
          onClick={setFeaturesOnModel}
        >
          Load Volvox GFF3
        </Button>
      </div>
    )
  }

  return <ReactComponent key={linearGenomeView.id} model={linearGenomeView} />
})

function makeFeatures(gff3Contents: GFF3Item[], assemblyName: string) {
  const featuresByRefName: Record<
    string,
    Record<string, SnapshotIn<typeof AnnotationFeature> | undefined> | undefined
  > = {}
  for (const gff3Item of gff3Contents) {
    if (Array.isArray(gff3Item)) {
      gff3Item.forEach((feature, idx) => {
        if (!feature.seq_id) {
          throw new Error('Got GFF3 record without an ID')
        }
        if (!feature.type) {
          throw new Error('Got GFF3 record without a type')
        }
        const convertedFeature = convertFeature(feature, idx, assemblyName)
        const { refName } = convertedFeature.location
        let refRecord = featuresByRefName[refName]
        if (!refRecord) {
          refRecord = {}
          featuresByRefName[refName] = refRecord
        }
        refRecord[convertedFeature.id] = convertedFeature
      })
    }
  }
  return featuresByRefName
}

function convertFeature(
  feature: GFF3FeatureLineWithRefs,
  idx: number,
  assemblyName: string,
): SnapshotIn<typeof AnnotationFeature> {
  if (!feature.seq_id) {
    throw new Error('Got GFF3 record without an ID')
  }
  if (!feature.type) {
    throw new Error('Got GFF3 record without a type')
  }
  if (!feature.start) {
    throw new Error('Got GFF3 record without a start')
  }
  if (!feature.end) {
    throw new Error('Got GFF3 record without an end')
  }
  const attributeID = feature.attributes?.ID?.[0]
  const id = attributeID ? `${attributeID}-${idx}` : objectHash(feature)
  const children: Record<string, SnapshotIn<typeof AnnotationFeature>> = {}
  feature.child_features.forEach((childFeatureLocation) => {
    childFeatureLocation.forEach((childFeature, idx2) => {
      const childFeat = convertFeature(childFeature, idx2, assemblyName)
      children[childFeat.id] = childFeat
    })
  })
  const newFeature: SnapshotIn<typeof AnnotationFeature> = {
    id,
    assemblyName,
    location: {
      refName: feature.seq_id,
      start: feature.start,
      end: feature.end,
    },
  }
  if (Array.from(Object.entries(children)).length) {
    newFeature.children = children
  }
  return newFeature
}

function hashCode(str: string) {
  let hash = 0
  let i
  let chr
  if (str.length === 0) {
    return hash
  }
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function objectHash(obj: Record<string, any>) {
  return `${hashCode(JSON.stringify(obj))}`
}
