import {
  type AnnotationFeature,
  type TranscriptPartCoding,
} from '@apollo-annotation/mst'
import { type MenuItem } from '@jbrowse/core/ui'
import { type AbstractSessionModel } from '@jbrowse/core/util'
import { type LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

import { type LinearApolloDisplayMouseEvents } from '../LinearApolloDisplay/stateModel/mouseEvents'
import { type LinearApolloSixFrameDisplayMouseEvents } from '../LinearApolloSixFrameDisplay/stateModel/mouseEvents'
import { AddChildFeature, CopyFeature, DeleteFeature } from '../components'

type NavLocation = Parameters<LinearGenomeViewModel['navTo']>[0]

export function getMinAndMaxPx(
  feature: AnnotationFeature | TranscriptPartCoding,
  refName: string,
  regionNumber: number,
  lgv: LinearGenomeViewModel,
): [number, number] | undefined {
  const minPxInfo = lgv.bpToPx({
    refName,
    coord: feature.min,
    regionNumber,
  })
  const maxPxInfo = lgv.bpToPx({
    refName,
    coord: feature.max,
    regionNumber,
  })
  if (minPxInfo === undefined || maxPxInfo === undefined) {
    return
  }
  const { offsetPx } = lgv
  const minPx = minPxInfo.offsetPx - offsetPx
  const maxPx = maxPxInfo.offsetPx - offsetPx
  return [minPx, maxPx]
}

export function getOverlappingEdge(
  feature: AnnotationFeature,
  x: number,
  minMax: [number, number],
): { feature: AnnotationFeature; edge: 'min' | 'max' } | undefined {
  const [minPx, maxPx] = minMax
  // Feature is too small to tell if we're overlapping an edge
  if (Math.abs(maxPx - minPx) < 8) {
    return
  }
  if (Math.abs(minPx - x) < 4) {
    return { feature, edge: 'min' }
  }
  if (Math.abs(maxPx - x) < 4) {
    return { feature, edge: 'max' }
  }
  return
}

export function isSelectedFeature(
  feature: AnnotationFeature,
  selectedFeature: AnnotationFeature | undefined,
) {
  return Boolean(selectedFeature && feature._id === selectedFeature._id)
}

export function containsSelectedFeature(
  feature: AnnotationFeature,
  selectedFeature: AnnotationFeature | undefined,
): boolean {
  if (!selectedFeature) {
    return false
  }
  if (feature._id === selectedFeature._id) {
    return true
  }
  return feature.hasDescendant(selectedFeature._id)
}

function makeFeatureLabel(feature: AnnotationFeature) {
  let name: string | undefined
  if (feature.attributes.get('gff_name')) {
    name = feature.attributes.get('gff_name')?.join(',')
  } else if (feature.attributes.get('gff_id')) {
    name = feature.attributes.get('gff_id')?.join(',')
  } else {
    name = feature._id
  }
  const coords = `(${(feature.min + 1).toLocaleString('en')}..${feature.max.toLocaleString('en')})`
  const maxLen = 60
  if (name && name.length + coords.length > maxLen + 5) {
    const trim = maxLen - coords.length
    name = trim > 0 ? name.slice(0, trim) : ''
    name = `${name}[...]`
  }
  return `${name} ${coords}`
}

export function getContextMenuItemsForFeature(
  display:
    | LinearApolloSixFrameDisplayMouseEvents
    | LinearApolloDisplayMouseEvents,
  sourceFeature: AnnotationFeature,
): MenuItem[] {
  const {
    apolloInternetAccount: internetAccount,
    changeManager,
    regions,
    selectedFeature,
    session,
  } = display
  const menuItems: MenuItem[] = []
  const role = internetAccount ? internetAccount.role : 'admin'
  const admin = role === 'admin'
  const readOnly = !(role && ['admin', 'user'].includes(role))
  const [region] = regions
  const sourceAssemblyId = display.getAssemblyId(region.assemblyName)
  const currentAssemblyId = display.getAssemblyId(region.assemblyName)
  menuItems.push(
    {
      label: makeFeatureLabel(sourceFeature),
      type: 'subHeader',
    },
    {
      label: 'Add child feature',
      disabled: readOnly,
      onClick: () => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            AddChildFeature,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager,
              sourceFeature,
              sourceAssemblyId,
              internetAccount,
            },
          ],
        )
      },
    },
    {
      label: 'Copy features and annotations',
      disabled: readOnly,
      onClick: () => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            CopyFeature,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager,
              sourceFeature,
              sourceAssemblyId: currentAssemblyId,
            },
          ],
        )
      },
    },
    {
      label: 'Delete feature',
      disabled: !admin,
      onClick: () => {
        ;(session as unknown as AbstractSessionModel).queueDialog(
          (doneCallback) => [
            DeleteFeature,
            {
              session,
              handleClose: () => {
                doneCallback()
              },
              changeManager,
              sourceFeature,
              sourceAssemblyId: currentAssemblyId,
              selectedFeature,
              setSelectedFeature: (feature?: AnnotationFeature) => {
                display.setSelectedFeature(feature)
              },
            },
          ],
        )
      },
    },
  )
  return menuItems
}

export function navToFeatureCenter(
  feature: AnnotationFeature,
  paddingPct: number,
  refSeqLength: number,
): NavLocation {
  const paddingBp = (feature.max - feature.min) * paddingPct
  const start = Math.max(feature.min - paddingBp, 1)
  const end = Math.min(feature.max + paddingBp, refSeqLength)
  return { refName: feature.refSeq, start, end }
}
