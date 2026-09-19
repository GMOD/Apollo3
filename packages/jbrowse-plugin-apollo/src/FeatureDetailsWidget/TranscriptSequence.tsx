import type { AnnotationFeature } from '@apollo-annotation/mst'
import { observer } from 'mobx-react'
import { useMemo, useState } from 'react'

import type { ApolloSessionModel } from '../session'
import { SequenceOptionSelector } from './SequenceOptionSelector'
import { SequenceViewer } from './SequenceViewer'
import {
  type SegmentListType,
  getLocationIntervals,
  getSequenceSegments,
} from './sequenceSegments'

const defaultSelectedOption: SegmentListType = 'genomic'
const defaultSequenceOptions: SegmentListType[] = ['genomic', 'cDNA']

export const TranscriptSequence = observer(function TranscriptSequence({
  assembly,
  feature,
  refName,
  session,
}: {
  assembly: string
  feature: AnnotationFeature
  refName: string
  session: ApolloSessionModel
}) {
  const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
  const refData = currentAssembly?.getByRefName(refName)
  const { featureTypeOntology } = session.apolloDataStore.ontologyManager

  const [selectedOption, setSelectedOption] = useState<SegmentListType>(
    defaultSelectedOption,
  )

  const [firstCdsLocation] = feature.cdsLocations
  const sequenceOptions =
    firstCdsLocation.length > 0
      ? [...defaultSequenceOptions, 'CDS' as const, 'protein' as const]
      : defaultSequenceOptions
  const effectiveSelectedOption = sequenceOptions.includes(selectedOption)
    ? selectedOption
    : defaultSelectedOption

  // The reference sequence for this feature's range may not be loaded yet
  // when this component first mounts (it's fetched by the parent widget,
  // asynchronously). `refData.getSequence()` is a reactive read - tracked
  // by this `observer` component - so including the loaded length in the
  // memo dependencies picks up the sequence once it actually arrives instead
  // of staying stuck showing an empty sequence.
  const loadedSequenceLength = refData
    ? refData.getSequence(feature.min, feature.max).length
    : 0
  const sequenceSegments = useMemo(
    () =>
      refData
        ? getSequenceSegments(effectiveSelectedOption, feature, (min, max) =>
            refData.getSequence(min, max),
          )
        : [],
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [refData, feature, effectiveSelectedOption, loadedSequenceLength],
  )
  const locationIntervals = useMemo(
    () => getLocationIntervals(sequenceSegments),
    [sequenceSegments],
  )

  if (!(currentAssembly && refData)) {
    return null
  }
  if (!featureTypeOntology) {
    throw new Error('featureTypeOntology is undefined')
  }
  if (!featureTypeOntology.isTypeOf(feature.type, 'transcript')) {
    return null
  }

  return (
    <>
      <SequenceOptionSelector
        options={sequenceOptions}
        value={effectiveSelectedOption}
        onChange={setSelectedOption}
      />
      <SequenceViewer
        refSeqName={refData.name}
        strand={feature.strand === -1 ? -1 : 1}
        locationIntervals={locationIntervals}
        sequenceSegments={sequenceSegments}
      />
    </>
  )
})
export default TranscriptSequence
