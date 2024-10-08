import { AnnotationFeature, ApolloRefSeqI } from '@apollo-annotation/mst'
import { splitStringIntoChunks } from '@apollo-annotation/shared'
import { revcom } from '@jbrowse/core/util'
import {
  Button,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import React, { useState } from 'react'

import { ApolloSessionModel } from '../session'

export interface CDSInfo {
  id: string
  type: string
  strand: number
  min: number
  oldMin: number
  max: number
  oldMax: number
  startSeq: string
  endSeq: string
}

const getCDSInfo = (
  feature: AnnotationFeature,
  refData: ApolloRefSeqI,
): CDSInfo[] => {
  const CDSresult: CDSInfo[] = []
  const traverse = (
    currentFeature: AnnotationFeature,
    isParentMRNA: boolean,
  ) => {
    if (
      isParentMRNA &&
      (currentFeature.type === 'CDS' ||
        currentFeature.type === 'three_prime_UTR' ||
        currentFeature.type === 'five_prime_UTR')
    ) {
      let startSeq = refData.getSequence(
        Number(currentFeature.min) - 2,
        Number(currentFeature.min),
      )
      let endSeq = refData.getSequence(
        Number(currentFeature.max),
        Number(currentFeature.max) + 2,
      )

      if (currentFeature.strand === -1 && startSeq && endSeq) {
        startSeq = revcom(startSeq)
        endSeq = revcom(endSeq)
      }
      const oneCDS: CDSInfo = {
        id: currentFeature._id,
        type: currentFeature.type,
        strand: Number(currentFeature.strand),
        min: currentFeature.min + 1,
        max: currentFeature.max + 1,
        oldMin: currentFeature.min + 1,
        oldMax: currentFeature.max + 1,
        startSeq: startSeq || '',
        endSeq: endSeq || '',
      }
      CDSresult.push(oneCDS)
    }
    if (currentFeature.children) {
      for (const child of currentFeature.children) {
        traverse(child[1], feature.type === 'mRNA')
      }
    }
  }
  traverse(feature, feature.type === 'mRNA')
  CDSresult.sort((a, b) => {
    return Number(a.min) - Number(b.min)
  })
  if (CDSresult.length > 0) {
    CDSresult[0].startSeq = ''

    // eslint-disable-next-line unicorn/prefer-at
    CDSresult[CDSresult.length - 1].endSeq = ''

    // Loop through the array and clear "startSeq" or "endSeq" based on the conditions
    for (let i = 0; i < CDSresult.length; i++) {
      if (i > 0 && CDSresult[i].min === CDSresult[i - 1].max) {
        // Clear "startSeq" if the current item's "start" is equal to the previous item's "end"
        CDSresult[i].startSeq = ''
      }
      if (
        i < CDSresult.length - 1 &&
        CDSresult[i].max === CDSresult[i + 1].min
      ) {
        // Clear "endSeq" if the next item's "start" is equal to the current item's "end"
        CDSresult[i].endSeq = ''
      }
    }
  }
  return CDSresult
}

interface Props {
  textSegments: { text: string; color: string }[]
}

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

export const intronColor = 'rgb(120,120,120)' // Slightly brighter gray
export const utrColor = 'rgb(20,200,200)' // Slightly brighter cyan
export const proteinColor = 'rgb(220,70,220)' // Slightly brighter magenta
export const cdsColor = 'rgb(240,200,20)' // Slightly brighter yellow
export const updownstreamColor = 'rgb(255,130,130)' // Slightly brighter red
export const genomeColor = 'rgb(20,230,20)' // Slightly brighter green

let textSegments = [{ text: '', color: '' }]

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
  const [showSequence, setShowSequence] = useState(false)
  const [selectedOption, setSelectedOption] = useState('Select')

  if (!(currentAssembly && refData)) {
    return null
  }
  const refSeq = currentAssembly.getByRefName(refName)
  if (!refSeq) {
    return null
  }
  const transcriptItems = getCDSInfo(feature, refData)
  const { max, min } = feature
  let sequence = ''
  if (showSequence) {
    getSequenceAsString(min, max)
  }

  function getSequenceAsString(start: number, end: number): string {
    sequence = refSeq?.getSequence(start, end) ?? ''
    if (sequence === '') {
      void session.apolloDataStore.loadRefSeq([
        { assemblyName: assembly, refName, start, end },
      ])
    } else {
      sequence = formatSequence(sequence, refName, start, end)
    }
    getSequenceAsTextSegment(selectedOption) // For color coded sequence
    return sequence
  }

  const handleSeqButtonClick = () => {
    setShowSequence(!showSequence)
  }

  function getSequenceAsTextSegment(option: string) {
    let seqData = ''
    textSegments = []
    if (!refData) {
      return
    }
    switch (option) {
      case 'CDS': {
        textSegments.push({ text: `>${refName} : CDS\n`, color: 'black' })
        for (const item of transcriptItems) {
          if (item.type === 'CDS') {
            const refSeq: string = refData.getSequence(
              Number(item.min + 1),
              Number(item.max),
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            textSegments.push({ text: seqData, color: cdsColor })
          }
        }
        break
      }
      case 'cDNA': {
        textSegments.push({ text: `>${refName} : cDNA\n`, color: 'black' })
        for (const item of transcriptItems) {
          if (
            item.type === 'CDS' ||
            item.type === 'three_prime_UTR' ||
            item.type === 'five_prime_UTR'
          ) {
            const refSeq: string = refData.getSequence(
              Number(item.min + 1),
              Number(item.max),
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            if (item.type === 'CDS') {
              textSegments.push({ text: seqData, color: cdsColor })
            } else {
              textSegments.push({ text: seqData, color: utrColor })
            }
          }
        }
        break
      }
      case 'Full': {
        textSegments.push({
          text: `>${refName} : Full genomic\n`,
          color: 'black',
        })
        let lastEnd = 0
        let count = 0
        for (const item of transcriptItems) {
          count++
          if (
            lastEnd != 0 &&
            lastEnd != Number(item.min) &&
            count != transcriptItems.length
          ) {
            // Intron etc. between CDS/UTRs. No need to check this on very last item
            const refSeq: string = refData.getSequence(
              lastEnd + 1,
              Number(item.min) - 1,
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            textSegments.push({ text: seqData, color: 'black' })
          }
          if (
            item.type === 'CDS' ||
            item.type === 'three_prime_UTR' ||
            item.type === 'five_prime_UTR'
          ) {
            const refSeq: string = refData.getSequence(
              Number(item.min + 1),
              Number(item.max),
            )
            seqData += item.strand === -1 && refSeq ? revcom(refSeq) : refSeq
            switch (item.type) {
              case 'CDS': {
                textSegments.push({ text: seqData, color: cdsColor })
                break
              }
              case 'three_prime_UTR': {
                textSegments.push({ text: seqData, color: utrColor })
                break
              }
              case 'five_prime_UTR': {
                textSegments.push({ text: seqData, color: utrColor })
                break
              }
              default: {
                textSegments.push({ text: seqData, color: 'black' })
                break
              }
            }
          }
          lastEnd = Number(item.max)
        }
        break
      }
    }
  }

  function handleChangeSeqOption(e: SelectChangeEvent) {
    const option = e.target.value
    setSelectedOption(option)
    getSequenceAsTextSegment(option)
  }

  // Function to copy text to clipboard
  const copyToClipboard = () => {
    const textToCopy = textSegments.map((segment) => segment.text).join('')

    if (textToCopy) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          // console.log('Text copied to clipboard!')
        })
        .catch((error: unknown) => {
          console.error('Failed to copy text to clipboard', error)
        })
    }
  }

  const ColoredText: React.FC<Props> = ({ textSegments }) => {
    return (
      <div>
        {textSegments.map((segment, index) => (
          <span key={index} style={{ color: segment.color }}>
            {splitStringIntoChunks(segment.text, 150).join('\n')}
          </span>
        ))}
      </div>
    )
  }

  return (
    <>
      <Typography
        style={{ display: 'inline', marginLeft: '15px' }}
        variant="h5"
      >
        Sequence
      </Typography>
      <div>
        <Button
          variant="contained"
          style={{ marginLeft: '15px' }}
          onClick={handleSeqButtonClick}
        >
          {showSequence ? 'Hide sequence' : 'Show sequence'}
        </Button>
      </div>
      <div>
        {showSequence && (
          <Select
            value={selectedOption}
            onChange={handleChangeSeqOption}
            style={{ width: '150px', marginLeft: '15px', height: '25px' }}
          >
            <MenuItem value={'Select'}>Select</MenuItem>
            <MenuItem value={'CDS'}>CDS</MenuItem>
            <MenuItem value={'cDNA'}>cDNA</MenuItem>
            <MenuItem value={'Full'}>Full genomics</MenuItem>
          </Select>
        )}
      </div>
      <div
        style={{
          width: '500px',
          marginLeft: '15px',
          height: '300px',
          overflowY: 'auto',
          border: '1px solid #ccc',
        }}
      >
        {showSequence && <ColoredText textSegments={textSegments} />}
      </div>
      {showSequence && (
        <Button
          variant="contained"
          style={{ marginLeft: '15px' }}
          onClick={copyToClipboard}
        >
          Copy sequence
        </Button>
      )}
    </>
  )
})
export default TranscriptSequence
