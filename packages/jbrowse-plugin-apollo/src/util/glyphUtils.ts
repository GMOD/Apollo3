import type {
  AnnotationFeature,
  Children,
  TranscriptPartCoding,
} from '@apollo-annotation/mst'
import type { BaseDisplayModel } from '@jbrowse/core/pluggableElementTypes'
import type { MenuItem } from '@jbrowse/core/ui'
import {
  type AbstractSessionModel,
  getContainingView,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded'
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded'

import type { LinearApolloDisplayMouseEvents } from '../LinearApolloDisplay/stateModel/mouseEvents'
import type { LinearApolloSixFrameDisplayMouseEvents } from '../LinearApolloSixFrameDisplay/stateModel/mouseEvents'
import { AddChildFeature, CopyFeature, DeleteFeature } from '../components'
import type { ApolloSessionModel } from '../session'

import type { MousePositionWithFeature } from '.'

type NavLocation = Parameters<LinearGenomeViewModel['navTo']>[0]

export function selectFeatureAndOpenWidget(
  stateModel:
    | LinearApolloDisplayMouseEvents
    | LinearApolloSixFrameDisplayMouseEvents,
  feature: AnnotationFeature,
) {
  if (stateModel.apolloDragging) {
    return
  }
  stateModel.setSelectedFeature(feature)
  const { session } = stateModel
  const { apolloDataStore } = session
  const { featureTypeOntology } = apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  let containsCDSOrExon = false
  for (const [, child] of feature.children ?? []) {
    if (
      featureTypeOntology.isTypeOf(child.type, 'CDS') ||
      featureTypeOntology.isTypeOf(child.type, 'exon')
    ) {
      containsCDSOrExon = true
      break
    }
  }
  if (
    (featureTypeOntology.isTypeOf(feature.type, 'transcript') ||
      featureTypeOntology.isTypeOf(feature.type, 'pseudogenic_transcript')) &&
    containsCDSOrExon
  ) {
    stateModel.showFeatureDetailsWidget(feature, [
      'ApolloTranscriptDetails',
      'apolloTranscriptDetails',
    ])
  } else {
    stateModel.showFeatureDetailsWidget(feature)
  }
}

export function isGeneFeature(
  feature: AnnotationFeature,
  session: ApolloSessionModel,
): boolean {
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  return (
    featureTypeOntology.isTypeOf(feature.type, 'gene') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogene')
  )
}

export function isTranscriptFeature(
  feature: AnnotationFeature,
  session: ApolloSessionModel,
): boolean {
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  return (
    featureTypeOntology.isTypeOf(feature.type, 'transcript') ||
    featureTypeOntology.isTypeOf(feature.type, 'pseudogenic_transcript')
  )
}

export function isExonFeature(
  feature: AnnotationFeature,
  session: ApolloSessionModel,
): boolean {
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  return featureTypeOntology.isTypeOf(feature.type, 'exon')
}

export function isCDSFeature(
  feature: AnnotationFeature,
  session: ApolloSessionModel,
): boolean {
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  return featureTypeOntology.isTypeOf(feature.type, 'CDS')
}

export function looksLikeGene(
  feature: AnnotationFeature,
  session: ApolloSessionModel,
) {
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  const children = feature.children as Children
  if (!children?.size) {
    return false
  }
  const isGene = isGeneFeature(feature, session)
  if (!isGene) {
    return false
  }
  for (const [, child] of children) {
    if (isTranscriptFeature(child, session)) {
      const { children: grandChildren } = child as { children?: Children }
      if (!grandChildren?.size) {
        return false
      }
      return [...grandChildren.values()].some((grandchild) =>
        isExonFeature(grandchild, session),
      )
    }
  }
  return false
}

export interface AdjacentExons {
  upstream: AnnotationFeature | undefined
  downstream: AnnotationFeature | undefined
}

export function getAdjacentExons(
  currentExon: AnnotationFeature,
  display:
    | LinearApolloDisplayMouseEvents
    | LinearApolloSixFrameDisplayMouseEvents,
  mousePosition: MousePositionWithFeature,
  session: ApolloSessionModel,
): AdjacentExons {
  const lgv = getContainingView(
    display as BaseDisplayModel,
  ) as unknown as LinearGenomeViewModel

  // Genomic coords of current view
  const viewGenomicLeft = mousePosition.bp - lgv.bpPerPx * mousePosition.x
  const viewGenomicRight = viewGenomicLeft + lgv.coarseTotalBp
  if (!currentExon.parent) {
    return { upstream: undefined, downstream: undefined }
  }
  const transcript = currentExon.parent
  if (!transcript.children) {
    throw new Error(`Error getting children of ${transcript._id}`)
  }
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }

  let exons = []
  for (const [, child] of transcript.children) {
    if (featureTypeOntology.isTypeOf(child.type, 'exon')) {
      exons.push(child)
    }
  }
  const adjacentExons: AdjacentExons = {
    upstream: undefined,
    downstream: undefined,
  }
  exons = exons.sort((a, b) => (a.min < b.min ? -1 : 1))
  for (const exon of exons) {
    if (exon.min > viewGenomicRight) {
      adjacentExons.downstream = exon
      break
    }
  }
  exons = exons.sort((a, b) => (a.min > b.min ? -1 : 1))
  for (const exon of exons) {
    if (exon.max < viewGenomicLeft) {
      adjacentExons.upstream = exon
      break
    }
  }
  if (transcript.strand === -1) {
    const newUpstream = adjacentExons.downstream
    adjacentExons.downstream = adjacentExons.upstream
    adjacentExons.upstream = newUpstream
  }
  return adjacentExons
}

export function getStreamIcon(
  strand: 1 | -1 | undefined,
  isUpstream: boolean,
  isFlipped: boolean | undefined,
) {
  // This is the icon you would use for strand=1, downstream, straight
  // (non-flipped) view
  let icon = SkipNextRoundedIcon

  if (strand === -1) {
    icon = SkipPreviousRoundedIcon
  }
  if (isUpstream) {
    icon =
      icon === SkipPreviousRoundedIcon
        ? SkipNextRoundedIcon
        : SkipPreviousRoundedIcon
  }
  if (isFlipped) {
    icon =
      icon === SkipPreviousRoundedIcon
        ? SkipNextRoundedIcon
        : SkipPreviousRoundedIcon
  }
  return icon
}

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
  if (isSessionModelWithWidgets(session)) {
    menuItems.push({
      label: 'Open feature details',
      onClick: () => {
        const apolloGeneWidget = session.addWidget(
          'ApolloFeatureDetailsWidget',
          'apolloFeatureDetailsWidget',
          {
            feature: sourceFeature,
            assembly: currentAssemblyId,
            refName: region.refName,
          },
        )
        session.showWidget(apolloGeneWidget)
      },
    })
  }
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
