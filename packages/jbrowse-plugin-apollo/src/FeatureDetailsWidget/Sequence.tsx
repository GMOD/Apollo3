import { Button, Typography } from '@mui/material'
import { AnnotationFeatureNew } from 'apollo-mst'
import { splitStringIntoChunks } from 'apollo-shared'
import { observer } from 'mobx-react'
import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'

import { ApolloSessionModel } from '../session'

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
  feature: AnnotationFeatureNew
  refName: string
  session: ApolloSessionModel
}) {
  const currentAssembly = session.apolloDataStore.assemblies.get(assembly)
  const [showSequence, setShowSequence] = useState(false)
  const { classes } = useStyles()

  const onButtonClick = () => {
    setShowSequence(!showSequence)
  }

  if (!(feature && currentAssembly)) {
    return null
  }
  const refSeq = currentAssembly.getByRefName(refName)
  if (!refSeq) {
    return null
  }
  const { end, start } = feature
  let sequence = ''
  if (showSequence) {
    sequence = refSeq.getSequence(start, end)
    if (sequence) {
      sequence = formatSequence(sequence, refName, start, end)
    } else {
      void session.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start, end },
      ])
    }
  }

  return (
    <>
      <Typography variant="h4">Sequence</Typography>
      <Button variant="contained" onClick={onButtonClick}>
        {showSequence ? 'Hide sequence' : 'Show sequence'}
      </Button>
      <div>
        {showSequence && (
          <textarea
            readOnly
            rows={20}
            className={classes.sequence}
            value={sequence}
          />
        )}
      </div>
    </>
  )
})
export default Sequence
