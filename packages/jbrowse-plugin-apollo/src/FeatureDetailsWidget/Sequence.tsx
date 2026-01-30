/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { type AnnotationFeature } from '@apollo-annotation/mst'
import { splitStringIntoChunks } from '@apollo-annotation/shared'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'
import React from 'react'

import { type ApolloSessionModel } from '../session'

function formatSequence(
  seq: string,
  refName: string,
  start: number,
  end: number,
  wrap?: number,
) {
  const header = `>${refName}:${start + 1}–${end}\n`
  const body =
    wrap === undefined ? seq : splitStringIntoChunks(seq, wrap).join('\n')
  return `${header}${body}`
}

const useStyles = makeStyles()({
  sequence: {
    width: '100%',
    resize: 'vertical',
  },
})

export const Sequence = observer(function Sequence({
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
  const { classes } = useStyles()

  if (!(feature && currentAssembly)) {
    return null
  }
  const refSeq = currentAssembly.getByRefName(refName)
  if (!refSeq) {
    return null
  }
  const { max, min } = feature
  let sequence = refSeq.getSequence(min, max)
  if (sequence) {
    sequence = formatSequence(sequence, refName, min, max)
  } else {
    void session.apolloDataStore.loadRefSeq([
      { assemblyName: assembly, refName, start: min, end: max },
    ])
  }

  return (
    <div>
      <textarea
        readOnly
        rows={20}
        className={classes.sequence}
        value={sequence}
      />
    </div>
  )
})
export default Sequence
